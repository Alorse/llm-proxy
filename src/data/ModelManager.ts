import * as vscode from 'vscode';

interface LlmModel {
    url: string;
    realModel: string;
}

export class ModelManager {
    private static readonly MODELS_KEY = 'llm-proxy.models';
    private _context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public async getModels(): Promise<{[key: string]: LlmModel}> {
        const models = this._context.globalState.get<{[key: string]: LlmModel}>(ModelManager.MODELS_KEY, {});
        console.log('ModelManager: getModels - Retrieved models:', models);
        return models;
    }

    public async addModel(alias: string, url: string, realModel: string): Promise<void> {
        const models = await this.getModels();
        models[alias] = { url, realModel };
        await this._context.globalState.update(ModelManager.MODELS_KEY, models);
        console.log(`ModelManager: addModel - Added model '${alias}'. Current models:`, models);
    }

    public async removeModel(alias: string): Promise<void> {
        const models = await this.getModels();
        delete models[alias];
        await this._context.globalState.update(ModelManager.MODELS_KEY, models);
        console.log(`ModelManager: removeModel - Removed model '${alias}'. Current models:`, models);
    }

    public async updateModel(alias: string, url: string, realModel: string): Promise<void> {
        const models = await this.getModels();
        if (models[alias]) {
            models[alias] = { url, realModel };
            await this._context.globalState.update(ModelManager.MODELS_KEY, models);
            console.log(`ModelManager: updateModel - Updated model '${alias}'. Current models:`, models);
        }
    }
}