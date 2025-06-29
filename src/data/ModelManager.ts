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
        return this._context.globalState.get<{[key: string]: LlmModel}>(ModelManager.MODELS_KEY, {});
    }

    public async addModel(alias: string, url: string, realModel: string): Promise<void> {
        const models = await this.getModels();
        models[alias] = { url, realModel };
        await this._context.globalState.update(ModelManager.MODELS_KEY, models);
    }

    public async removeModel(alias: string): Promise<void> {
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
}