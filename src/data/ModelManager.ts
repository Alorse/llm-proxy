import * as vscode from 'vscode';

export interface Model {
    id: string;
    alias: string;
    url: string;
    realModel: string;
    status?: 'running' | 'stopped';
}

export interface Models {
    [id: string]: Model;
}

export class ModelManager {
    private static readonly MODELS_KEY = 'llm-proxy.models';
    private _context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    private async getModelByAlias(alias: string): Promise<Model | undefined> {
        const models = await this.getModels();
        return Object.values(models).find(model => model.alias === alias);
    }

    public async getModels(): Promise<Models> {
        const models = this._context.globalState.get<Models>(ModelManager.MODELS_KEY, {});
        console.log('ModelManager: getModels - Retrieved models:', models);
        return models;
    }

    public async addModel(alias: string, url: string, realModel: string): Promise<string> {
        const existingModel = await this.getModelByAlias(alias);
        if (existingModel) {
            throw new Error(`Model with alias ${alias} already exists`);
        }

        const id = this.generateId();
        const models = await this.getModels();
        models[id] = { id, alias, url, realModel };
        await this._context.globalState.update(ModelManager.MODELS_KEY, models);
        console.log(`ModelManager: addModel - Added model '${alias}' with ID '${id}'. Current models:`, models);
        return id;
    }

    public async removeModel(id: string): Promise<void> {
        const models = await this.getModels();
        if (!models[id]) {
            throw new Error(`Model with ID ${id} not found`);
        }
        delete models[id];
        await this._context.globalState.update(ModelManager.MODELS_KEY, models);
        console.log(`ModelManager: removeModel - Removed model with ID '${id}'. Current models:`, models);
    }

    public async updateModel(id: string, alias: string, url: string, realModel: string): Promise<void> {
        const models = await this.getModels();
        if (!models[id]) {
            throw new Error(`Model with ID ${id} not found`);
        }

        const existingModel = await this.getModelByAlias(alias);
        if (existingModel && existingModel.id !== id) {
            throw new Error(`Another model with alias ${alias} already exists`);
        }

        models[id] = { id, alias, url, realModel };
        await this._context.globalState.update(ModelManager.MODELS_KEY, models);
        console.log(`ModelManager: updateModel - Updated model with ID '${id}'. Current models:`, models);
    }
}