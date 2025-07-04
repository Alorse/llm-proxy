import express from 'express';
import * as http from 'http';
import * as net from 'net';
import { Model } from '../data/ModelManager';

interface ProxyServer {
    app: express.Application;
    server: http.Server;
}

interface ProxyServers {
    [alias: string]: ProxyServer;
}

interface ServerAddress {
    port: number;
    family: string;
    address: string;
}

export class ProxyService {
    private servers: ProxyServers = {};

    public async startServer(alias: string, model: Model): Promise<number> {
        if (this.servers[alias]) {
            throw new Error(`Server for ${alias} is already running`);
        }

        // Validate model URL
        if (!model.url) {
            throw new Error(`Model URL is required for ${alias}`);
        }

        try {
            // Normalize the URL
            const baseUrl = new URL(model.url);
            // Remove trailing slashes
            const normalizedUrl = baseUrl.toString().replace(/\/+$/, '');
            model.url = normalizedUrl;
        } catch (error) {
            throw new Error(`Invalid URL for model ${alias}: ${model.url}`);
        }

        const app = express();
        const port = await this.findAvailablePort(4321);

        // Configure CORS to allow requests from VS Code
        app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            
            // Handle preflight requests
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
                return;
            }
            
            next();
        });

        app.use(express.json());

        const handleRequest = async (req: express.Request, res: express.Response) => {
            try {
                // Forward all headers except those we want to control
                const headers = { ...req.headers };
                delete headers.host;
                delete headers.connection;
                delete headers['content-length'];
                delete headers['accept-encoding']; // Let fetch handle compression
                delete headers['postman-token']; // Remove Postman-specific headers

                // Ensure content-type is set
                headers['content-type'] = 'application/json';

                // Construct and validate target URL
                const targetUrl = `${model.url}/chat/completions`;
                try {
                    new URL(targetUrl);
                } catch (error) {
                    res.status(400).json({
                        error: {
                            message: 'Invalid target URL configuration',
                            details: `Could not construct valid URL from: ${targetUrl}`
                        }
                    });
                    return;
                }

                const requestBody = {
                    ...(req.body as Record<string, unknown>),
                    model: model.realModel
                };
                const requestBodyString = JSON.stringify(requestBody);

                let response;
                try {
                    response = await fetch(targetUrl, {
                        method: 'POST',
                        headers: headers as HeadersInit,
                        body: requestBodyString
                    });
                } catch (fetchError) {
                    // Check if it's a DNS or connection error
                    const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
                    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
                        res.status(502).json({
                            error: {
                                message: 'Could not connect to the backend server',
                                type: 'ConnectionError',
                                details: errorMessage
                            }
                        });
                    } else {
                        res.status(500).json({
                            error: {
                                message: 'Failed to make request to backend server',
                                type: fetchError instanceof Error ? fetchError.name : 'UnknownError',
                                details: errorMessage
                            }
                        });
                    }
                    return;
                }

                // Convert headers to object for logging
                const responseHeadersObj: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    responseHeadersObj[key] = value;
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    res.status(response.status).json({
                        error: {
                            message: `Backend server error: ${response.status} ${response.statusText}`,
                            details: errorText
                        }
                    });
                    return;
                }

                // Forward response headers
                response.headers.forEach((value, key) => {
                    // Skip headers that Express will set
                    if (!['connection', 'content-length', 'transfer-encoding', 'content-encoding'].includes(key.toLowerCase())) {
                        res.setHeader(key, value);
                    }
                });

                const reqBody = req.body as Record<string, unknown>;
                const isStreaming = reqBody.stream === true;
                if (isStreaming) {
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');

                    const reader = response.body?.getReader();
                    if (!reader) {
                        throw new Error('No reader available');
                    }

                    const decoder = new TextDecoder();
                    try {
                        let done = false;
                        while (!done) {
                            const result = await reader.read();
                            done = result.done || false;
                            if (result.value) {
                                const chunk = decoder.decode(result.value);
                                // Forward the SSE data as-is without parsing
                                res.write(chunk);
                            }
                        }
                    } finally {
                        reader.releaseLock();
                    }
                    res.end();
                } else {
                    const data = await response.json() as Record<string, unknown>;
                    res.json(data);
                }
            } catch (error) {
                console.error(`[${alias}] Error in proxy request:`, error);
                // Log more details about the error
                if (error instanceof Error) {
                    console.error(`[${alias}] Error stack:`, error);
                }

                res.status(500).json({
                    error: {
                        message: error instanceof Error ? error.message : 'An unknown error occurred',
                        type: error instanceof Error ? error.name : 'UnknownError',
                        details: error instanceof Error ? error.stack : undefined
                    }
                });
            }
        };

        app.post('/v1/chat/completions', handleRequest);

        return new Promise((resolve, reject) => {
            try {
                const server = app.listen(port, () => {
                    this.servers[alias] = { app, server };
                    resolve(port);
                });

                server.on('error', (error: Error) => {
                    console.error(`[${alias}] Error starting server:`, error);
                    reject(error);
                });
            } catch (error) {
                console.error(`[${alias}] Error in server setup:`, error);
                reject(error);
            }
        });
    }

    public stopServer(alias: string): void {
        const server = this.servers[alias];
        if (server?.server) {
            server.server.close();
            delete this.servers[alias];
        }
    }

    public isRunning(alias: string): boolean {
        return !!this.servers[alias];
    }

    public getServer(alias: string): { port: number } | undefined {
        const server = this.servers[alias];
        if (!server) {
            return undefined;
        }

        const address = server.server.address() as ServerAddress | null;
        if (!address) {
            return undefined;
        }

        return { port: address.port };
    }

    private async findAvailablePort(startPort: number): Promise<number> {
        const isPortAvailable = (port: number): Promise<boolean> => {
            return new Promise((resolve) => {
                const server = net.createServer();
                server.once('error', () => resolve(false));
                server.once('listening', () => {
                    server.close(() => resolve(true));
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