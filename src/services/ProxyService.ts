import * as express from 'express';
import { Server } from 'http';
import { Model } from '../data/ModelManager';

interface ServerInfo {
    server: Server;
    port: number;
}

export class ProxyService {
    private servers: Map<string, ServerInfo> = new Map();
    private nextPort: number = 3000;

    startServer(alias: string, model: Model): Promise<number> {
        if (this.servers.has(alias)) {
            throw new Error(`Server for ${alias} is already running`);
        }

        const app = express();
        app.use(express.json());

        app.post('/v1/*', async (req, res) => {
            try {
                const response = await fetch(model.url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ...req.body,
                        model: model.realModel
                    })
                });

                // Set up SSE if the response is streaming
                if (response.headers.get('content-type')?.includes('text/event-stream')) {
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');

                    const reader = response.body?.getReader();
                    if (!reader) {
                        throw new Error('No reader available for streaming response');
                    }

                    let done = false;
                    while (!done) {
                        const result = await reader.read();
                        done = result.done;
                        if (!done) {
                            res.write(new TextDecoder().decode(result.value));
                        }
                    }
                    res.end();
                } else {
                    // Regular JSON response
                    const data = await response.json();
                    res.json(data);
                }
            } catch (error) {
                console.error('Error in proxy request:', error);
                res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
            }
        });

        return new Promise((resolve) => {
            const port = this.nextPort++;
            const server = app.listen(port, () => {
                this.servers.set(alias, { server, port });
                resolve(port);
            });
        });
    }

    stopServer(alias: string): void {
        const serverInfo = this.servers.get(alias);
        if (serverInfo) {
            serverInfo.server.close();
            this.servers.delete(alias);
        }
    }

    isRunning(alias: string): boolean {
        return this.servers.has(alias);
    }

    public stopAllServers(): void {
        for (const [alias, { server }] of this.servers.entries()) {
            server.close();
            console.log(`Stopped server for model ${alias}`);
        }
        this.servers.clear();
    }

    private async findAvailablePort(start: number, end: number): Promise<number> {
        for (let port = start; port <= end; port++) {
            try {
                const server = express().listen(port);
                server.close();
                return port;
            } catch {
                continue;
            }
        }
        throw new Error('No available ports found');
    }
} 