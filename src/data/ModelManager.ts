import * as vscode from 'vscode';

export interface Model {
    url: string;
    realModel: string;
    status?: 'running' | 'stopped';
}

export interface Models {
    [alias: string]: Model;
}

export class ModelManager {
    private static readonly MODELS_KEY = 'llm-proxy.models';
    private _context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public async getModels(): Promise<Models> {
        const models = this._context.globalState.get<Models>(ModelManager.MODELS_KEY, {});
        console.log('ModelManager: getModels - Retrieved models:', models);
        return models;
    }

    public async addModel(alias: string, url: string, realModel: string): Promise<void> {
        const models = await this.getModels();
        if (models[alias]) {
            throw new Error(`Model with alias ${alias} already exists`);
        }
        models[alias] = { url, realModel };
        await this._context.globalState.update(ModelManager.MODELS_KEY, models);
        console.log(`ModelManager: addModel - Added model '${alias}'. Current models:`, models);
    }

    public async removeModel(alias: string): Promise<void> {
        const models = await this.getModels();
        if (!models[alias]) {
            throw new Error(`Model with alias ${alias} not found`);
        }
        delete models[alias];
        await this._context.globalState.update(ModelManager.MODELS_KEY, models);
        console.log(`ModelManager: removeModel - Removed model '${alias}'. Current models:`, models);
    }

    public async updateModel(alias: string, url: string, realModel: string): Promise<void> {
        const models = await this.getModels();
        if (!models[alias]) {
            throw new Error(`Model with alias ${alias} not found`);
        }
        models[alias] = { url, realModel };
        await this._context.globalState.update(ModelManager.MODELS_KEY, models);
        console.log(`ModelManager: updateModel - Updated model '${alias}'. Current models:`, models);
    }
}