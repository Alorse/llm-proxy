import * as vscode from 'vscode';
import { ModelManager, Model } from '../data/ModelManager';
import { ProxyService } from '../services/ProxyService';
import { getWebviewContent } from './templates/modelsPanel';

interface ModelWithStatus extends Model {
    status: 'running' | 'stopped';
}

interface ModelsWithStatus {
    [id: string]: ModelWithStatus;
}

export class ModelsPanel implements vscode.WebviewViewProvider {
    public static readonly viewType = 'llmProxy.modelView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _modelManager: ModelManager,
        private readonly _proxyService: ProxyService
    ) {}

    public resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = getWebviewContent();
        this._setWebviewMessageListener(webviewView.webview);
    }

    private _setWebviewMessageListener(webview: vscode.Webview): void {
        webview.onDidReceiveMessage(async (message: { type: string; id?: string; alias?: string; url?: string; realModel?: string; action?: string; message?: string }) => {
            try {
                switch (message.type) {
                    case 'getModels': {
                        await this._refreshModels();
                        break;
                    }

                    case 'addModel': {
                        if (!message.alias || !message.url || !message.realModel) {
                            throw new Error('All fields are required');
                        }
                        const id = await this._modelManager.addModel(message.alias, message.url, message.realModel);
                        await vscode.window.showInformationMessage(`Model ${message.alias} added successfully`);
                        await this._refreshModels();
                        break;
                    }

                    case 'modelAction': {
                        if (!message.id || !message.action) {
                            throw new Error('Missing required fields for model action');
                        }
                        await this._handleModelAction(message.id, message.action);
                        break;
                    }

                    case 'updateModel': {
                        if (!message.id || !message.alias || !message.url || !message.realModel) {
                            throw new Error('All fields are required');
                        }
                        await this._modelManager.updateModel(message.id, message.alias, message.url, message.realModel);
                        await vscode.window.showInformationMessage(`Model ${message.alias} updated successfully`);
                        
                        const models = await this._modelManager.getModels();
                        const model = models[message.id];
                        if (this._proxyService.isRunning(model.alias)) {
                            this._proxyService.stopServer(model.alias);
                            const port = await this._proxyService.startServer(model.alias, model);
                            await vscode.window.showInformationMessage(
                                `Proxy restarted for ${message.alias}\nURL: http://localhost:${port}/v1\nModel: ${message.realModel}`
                            );
                        }
                        
                        await this._refreshModels();
                        break;
                    }

                    case 'error': {
                        if (message.message) {
                            await vscode.window.showErrorMessage(message.message);
                        }
                        break;
                    }
                }
            } catch (error) {
                await vscode.window.showErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred');
            }
        });
    }

    private async _handleModelAction(id: string, action: string): Promise<void> {
        const models = await this._modelManager.getModels();
        const model = models[id];

        if (!model) {
            await vscode.window.showErrorMessage(`Model with ID ${id} not found`);
            return;
        }

        try {
            switch (action) {
                case 'start': {
                    const port = await this._proxyService.startServer(model.alias, model);
                    await vscode.window.showInformationMessage(
                        `Proxy started for ${model.alias}\nURL: http://localhost:${port}/v1\nModel: ${model.realModel}`
                    );
                    await this._refreshModels();
                    break;
                }

                case 'stop': {
                    this._proxyService.stopServer(model.alias);
                    await vscode.window.showInformationMessage(`Server for ${model.alias} stopped`);
                    await this._refreshModels();
                    break;
                }

                case 'edit': {
                    if (this._view) {
                        await this._view.webview.postMessage({
                            type: 'editModel',
                            model
                        });
                    }
                    break;
                }

                case 'delete': {
                    const answer = await vscode.window.showWarningMessage(
                        `Are you sure you want to delete model ${model.alias}?`,
                        'Yes',
                        'No'
                    );
                    if (answer === 'Yes') {
                        if (this._proxyService.isRunning(model.alias)) {
                            this._proxyService.stopServer(model.alias);
                        }
                        await this._modelManager.removeModel(id);
                        await vscode.window.showInformationMessage(`Model ${model.alias} deleted`);
                        await this._refreshModels();
                    }
                    break;
                }
            }
        } catch (error) {
            await vscode.window.showErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred');
        }
    }

    private async _refreshModels(): Promise<void> {
        if (this._view) {
            const models = await this._modelManager.getModels();
            const modelsWithStatus: ModelsWithStatus = Object.entries(models).reduce((acc, [id, model]) => {
                acc[id] = {
                    ...model,
                    status: this._proxyService.isRunning(model.alias) ? 'running' : 'stopped'
                };
                return acc;
            }, {} as ModelsWithStatus);

            // Force a complete refresh of the webview
            this._view.webview.html = getWebviewContent();
            
            // Wait a bit for the webview to initialize
            await new Promise(resolve => setTimeout(resolve, 100));

            await this._view.webview.postMessage({
                type: 'updateModels',
                models: modelsWithStatus
            });
        }
    }
} 