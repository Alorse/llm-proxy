import express, { Request, Response } from 'express';
import * as vscode from 'vscode';
import { Model } from '../data/ModelManager';

interface ProxyServer {
    app: express.Application;
    server: any;
}

interface ProxyServers {
    [alias: string]: ProxyServer;
}

export class ProxyService {
    private servers: ProxyServers = {};

    public async startServer(alias: string, model: Model): Promise<number> {
        if (this.servers[alias]) {
            throw new Error(`Server for ${alias} is already running`);
        }

        const app = express();
        const port = await this.findAvailablePort(3000);

        app.use(express.json());

        app.post('/v1/chat/completions', async (req: Request, res: Response) => {
            try {
                const response = await fetch(model.url + '/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ...req.body,
                        model: model.realModel
                    })
                });

                if (req.headers.accept?.includes('text/event-stream')) {
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');

                    const reader = response.body?.getReader();
                    if (!reader) {
                        throw new Error('No reader available');
                    }

                    const decoder = new TextDecoder();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        res.write(decoder.decode(value));
                    }
                    res.end();
                } else {
                    const data = await response.json();
                    res.json(data);
                }
            } catch (error) {
                console.error('Error in proxy request:', error);
                res.status(500).json({
                    error: {
                        message: error instanceof Error ? error.message : 'An unknown error occurred'
                    }
                });
            }
        });

        return new Promise((resolve, reject) => {
            try {
                const server = app.listen(port, () => {
                    this.servers[alias] = { app, server };
                    console.log(`Proxy server for ${alias} started on port ${port}`);
                    resolve(port);
                });

                server.on('error', (error: Error) => {
                    console.error(`Error starting server for ${alias}:`, error);
                    reject(error);
                });
            } catch (error) {
                console.error(`Error in server setup for ${alias}:`, error);
                reject(error);
            }
        });
    }

    public stopServer(alias: string): void {
        const server = this.servers[alias];
        if (server) {
            server.server.close();
            delete this.servers[alias];
            console.log(`Server for ${alias} stopped`);
        }
    }

    public isRunning(alias: string): boolean {
        return !!this.servers[alias];
    }

    private async findAvailablePort(startPort: number): Promise<number> {
        const isPortAvailable = (port: number): Promise<boolean> => {
            return new Promise((resolve) => {
                const server = require('net').createServer();
                server.once('error', () => resolve(false));
                server.once('listening', () => {
                    server.close();
                    resolve(true);
                });
                server.listen(port);
            });
        };

        let port = startPort;
        while (!(await isPortAvailable(port))) {
            port++;
        }
        return port;
    }
} 