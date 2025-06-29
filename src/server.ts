import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as vscode from 'vscode';
import http from 'http';

export function createServer(context: vscode.ExtensionContext): http.Server {
    const app = express();
    app.use(express.json());

    const getModels = () => context.globalState.get<{[key: string]: {url: string, realModel: string}}>('llm-proxy.models', {});

    const proxy = createProxyMiddleware({
        router: (req) => {
            const models = getModels();
            const modelKey = (req.body as { model: string }).model;
            if (models[modelKey]) {
                return models[modelKey].url;
            }
            return null; // Will result in a 404
        },
        changeOrigin: true,
        onProxyReq: (proxyReq, req) => {
            const models = getModels();
            const modelKey = (req.body as { model: string }).model;
            const realModel = models[modelKey]?.realModel;

            if (realModel) {
                const oldBody = req.body;
                const newBody = JSON.stringify({ ...oldBody, model: realModel });
                proxyReq.setHeader('Content-Length', Buffer.byteLength(newBody));
                proxyReq.write(newBody);
            }
        },
        onError: (err, req, res) => {
            console.error('Proxy error:', err);
            if (!res.headersSent) {
                res.status(500).send('Proxy error');
            }
        }
    });

    app.use('/v1/chat/completions', proxy);

    const server = http.createServer(app);

    server.listen(4891, () => {
        console.log('LLM Proxy server started on port 4891');
    });

    return server;
}
