import * as vscode from 'vscode';
import * as child_process from 'child_process';

interface LlmModel {
    url: string;
    realModel: string;
}

interface ServerStatus {
    running: boolean;
    pid?: number;
    port?: number;
    localUrl?: string;
}

export class ModelManager {
    private static readonly MODELS_KEY = 'llm-proxy.models';
    private static readonly SERVER_STATUS_KEY = 'llm-proxy.server-status';
    private _context: vscode.ExtensionContext;
    private _servers: Map<string, child_process.ChildProcess> = new Map();

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public async getModels(): Promise<{[key: string]: LlmModel}> {
        return this._context.globalState.get<{[key: string]: LlmModel}>(ModelManager.MODELS_KEY, {});
    }

    public async getServerStatus(): Promise<{[key: string]: ServerStatus}> {
        return this._context.globalState.get<{[key: string]: ServerStatus}>(ModelManager.SERVER_STATUS_KEY, {});
    }

    public async addModel(alias: string, url: string, realModel: string): Promise<void> {
        const models = await this.getModels();
        models[alias] = { url, realModel };
        await this._context.globalState.update(ModelManager.MODELS_KEY, models);
    }

    public async removeModel(alias: string): Promise<void> {
        await this.stopServer(alias);
        const models = await this.getModels();
        delete models[alias];
        await this._context.globalState.update(ModelManager.MODELS_KEY, models);
    }

    public async updateModel(alias: string, url: string, realModel: string): Promise<void> {
        const models = await this.getModels();
        if (models[alias]) {
            models[alias] = { url, realModel };
            await this._context.globalState.update(ModelManager.MODELS_KEY, models);
        }
    }

    public async startServer(alias: string): Promise<ServerStatus> {
        const status = await this.getServerStatus();
        const models = await this.getModels();
        
        if (status[alias]?.running) {
            return status[alias];
        }

        if (!models[alias]) {
            throw new Error(`Model ${alias} not found`);
        }

        const port = this._getAvailablePort();
        const serverProcess = child_process.spawn('node', [
            require.resolve('./serverStarter'),
            '--port', port.toString(),
            '--model', models[alias].realModel
        ]);
        
        this._servers.set(alias, serverProcess);
        
        const newStatus: ServerStatus = {
            running: true,
            pid: serverProcess.pid,
            port: port,
            localUrl: `http://localhost:${port}`
        };
        
        status[alias] = newStatus;
        await this._context.globalState.update(ModelManager.SERVER_STATUS_KEY, status);
        
        return newStatus;
    }

    public async stopServer(alias: string): Promise<ServerStatus> {
        const status = await this.getServerStatus();
        
        if (!status[alias]?.running) {
            return status[alias] || { running: false };
        }

        const serverProcess = this._servers.get(alias);
        if (serverProcess) {
            serverProcess.kill();
            this._servers.delete(alias);
        }
        
        const newStatus: ServerStatus = {
            running: false,
            localUrl: status[alias].localUrl
        };
        
        status[alias] = newStatus;
        await this._context.globalState.update(ModelManager.SERVER_STATUS_KEY, status);
        
        return newStatus;
    }

    private _getAvailablePort(): number {
        // Implementación real de selección de puerto aquí
        return 3000 + Math.floor(Math.random() * 1000);
    }
}