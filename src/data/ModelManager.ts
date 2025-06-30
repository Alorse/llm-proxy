import * as vscode from 'vscode';
import { ProxyService } from '../services/ProxyService';

export interface Model {
    id: string;
    alias: string;
    url: string;
    realModel: string;
    default?: boolean;
}

export class ModelManager {
    private context: vscode.ExtensionContext;
    private proxyService: ProxyService;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.proxyService = new ProxyService();
    }

    public async getModels(): Promise<{ [id: string]: Model }> {
        const models = this.context.globalState.get<{ [id: string]: Model }>('models', {});
        return models;
    }

    public async getAllModels(): Promise<Model[]> {
        const models = await this.getModels();
        const modelArray = Object.values(models);
        return modelArray;
    }

    public async getModel(alias: string): Promise<Model | undefined> {
        const models = await this.getModels();
        const model = Object.values(models).find(model => model.alias === alias);
        return model;
    }

    public async addModel(alias: string, url: string, realModel: string, isDefault: boolean = false): Promise<string> {
        const models = await this.getModels();
        
        // Check if alias already exists
        if (Object.values(models).some(model => model.alias === alias)) {
            throw new Error(`Model with alias ${alias} already exists`);
        }

        // Si es default, desmarcar los demás
        if (isDefault) {
            Object.values(models).forEach(model => { model.default = false; });
        }

        const id = Date.now().toString();
        models[id] = { id, alias, url, realModel, default: isDefault };
        await this.context.globalState.update('models', models);
        return id;
    }

    public async updateModel(id: string, alias: string, url: string, realModel: string, isDefault?: boolean): Promise<void> {
        const models = await this.getModels();
        
        // Check if the new alias already exists (except for the current model)
        if (Object.values(models).some(model => model.alias === alias && model.id !== id)) {
            throw new Error(`Model with alias ${alias} already exists`);
        }

        if (!models[id]) {
            throw new Error(`Model with ID ${id} not found`);
        }

        // Si es default, desmarcar los demás
        if (isDefault) {
            Object.values(models).forEach(model => { model.default = false; });
        }

        // If the model is running, stop it first
        if (this.proxyService.isRunning(models[id].alias)) {
            this.proxyService.stopServer(models[id].alias);
        }

        models[id] = { id, alias, url, realModel, default: isDefault ?? models[id].default };
        await this.context.globalState.update('models', models);
    }

    public async removeModel(id: string): Promise<void> {
        const models = await this.getModels();
        
        if (!models[id]) {
            throw new Error(`Model with ID ${id} not found`);
        }

        // If the model is running, stop it first
        if (this.proxyService.isRunning(models[id].alias)) {
            this.proxyService.stopServer(models[id].alias);
        }

        delete models[id];
        await this.context.globalState.update('models', models);
    }

    public async deleteModel(alias: string): Promise<void> {
        const models = await this.getModels();
        const model = Object.values(models).find(m => m.alias === alias);
        
        if (!model) {
            throw new Error(`Model with alias ${alias} not found`);
        }

        // If the model is running, stop it first
        if (this.proxyService.isRunning(alias)) {
            this.proxyService.stopServer(alias);
        }

        delete models[model.id];
        await this.context.globalState.update('models', models);
    }

    public async startProxy(alias: string): Promise<number> {
        const model = await this.getModel(alias);
        if (!model) {
            throw new Error(`Model with alias ${alias} not found`);
        }
        const port = await this.proxyService.startServer(alias, model);
        return port;
    }

    public async stopProxy(alias: string): Promise<void> {
        if (!this.proxyService.isRunning(alias)) {
            throw new Error(`Proxy for ${alias} is not running`);
        }
        this.proxyService.stopServer(alias);
    }

    public isProxyRunning(alias: string): boolean {
        const isRunning = this.proxyService.isRunning(alias);
        return isRunning;
    }

    public getProxyPort(alias: string): number | undefined {
        const server = this.proxyService.getServer(alias);
        return server?.port;
    }
}