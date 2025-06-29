import express, { Request, Response, RequestHandler } from 'express';
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
        const port = await this.findAvailablePort(4123);

        app.use(express.json());

        const handleRequest: RequestHandler = async (req, res) => {
            try {
                // Log incoming request
                console.log(`[${alias}] Incoming request:`, {
                    headers: req.headers,
                    body: req.body
                });

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
                    console.error(`[${alias}] Invalid target URL:`, targetUrl);
                    res.status(400).json({
                        error: {
                            message: 'Invalid target URL configuration',
                            details: `Could not construct valid URL from: ${targetUrl}`
                        }
                    });
                    return;
                }

                console.log(`[${alias}] Forwarding request to:`, targetUrl);
                console.log(`[${alias}] With headers:`, headers);

                const requestBody = {
                    ...req.body,
                    model: model.realModel
                };
                const requestBodyString = JSON.stringify(requestBody);
                console.log(`[${alias}] With body:`, requestBody);

                let response;
                try {
                    response = await fetch(targetUrl, {
                        method: 'POST',
                        headers: headers as HeadersInit,
                        body: requestBodyString
                    });
                } catch (fetchError) {
                    console.error(`[${alias}] Fetch error:`, fetchError);
                    console.error(`[${alias}] Target URL:`, targetUrl);
                    console.error(`[${alias}] Request headers:`, headers);
                    console.error(`[${alias}] Request body:`, requestBody);

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

                // Log response status
                console.log(`[${alias}] Response status:`, response.status);
                
                // Convert headers to object for logging
                const responseHeadersObj: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    responseHeadersObj[key] = value;
                });
                console.log(`[${alias}] Response headers:`, responseHeadersObj);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[${alias}] Error response from server:`, errorText);
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

                const isStreaming = req.body.stream === true;
                if (isStreaming) {
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
                        const chunk = decoder.decode(value);
                        console.log(`[${alias}] Streaming chunk:`, chunk);
                        // Forward the SSE data as-is without parsing
                        res.write(chunk);
                    }
                    res.end();
                } else {
                    const data = await response.json();
                    console.log(`[${alias}] Response data:`, data);
                    res.json(data);
                }
            } catch (error) {
                console.error(`[${alias}] Error in proxy request:`, error);
                // Log more details about the error
                if (error instanceof Error) {
                    console.error(`[${alias}] Error stack:`, error.stack);
                    console.error(`[${alias}] Error name:`, error.name);
                    console.error(`[${alias}] Error message:`, error.message);
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
                    console.log(`[${alias}] Proxy server started on port ${port}`);
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
        if (server) {
            server.server.close();
            delete this.servers[alias];
            console.log(`[${alias}] Server stopped`);
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