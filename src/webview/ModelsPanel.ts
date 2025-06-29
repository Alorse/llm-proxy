import * as vscode from 'vscode';
import { ModelManager, Model } from '../data/ModelManager';
import { ProxyService } from '../services/ProxyService';
import { getWebviewContent } from './templates/modelsPanel';

interface ModelWithStatus extends Model {
    status: 'running' | 'stopped';
}

interface ModelsWithStatus {
    [alias: string]: ModelWithStatus;
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
        webview.onDidReceiveMessage(async (message: { type: string; alias?: string; url?: string; realModel?: string; action?: string; message?: string }) => {
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
                        await this._modelManager.addModel(message.alias, message.url, message.realModel);
                        await vscode.window.showInformationMessage(`Model ${message.alias} added successfully`);
                        await this._refreshModels();
                        break;
                    }

                    case 'modelAction': {
                        if (!message.alias || !message.action) {
                            throw new Error('Missing required fields for model action');
                        }
                        await this._handleModelAction(message.alias, message.action);
                        break;
                    }

                    case 'updateModel': {
                        if (!message.alias || !message.url || !message.realModel) {
                            throw new Error('All fields are required');
                        }
                        await this._modelManager.updateModel(message.alias, message.url, message.realModel);
                        await vscode.window.showInformationMessage(`Model ${message.alias} updated successfully`);
                        
                        if (this._proxyService.isRunning(message.alias)) {
                            this._proxyService.stopServer(message.alias);
                            const port = await this._proxyService.startServer(message.alias, { url: message.url, realModel: message.realModel });
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

    private async _handleModelAction(alias: string, action: string): Promise<void> {
        const models = await this._modelManager.getModels();
        const model = models[alias];

        if (!model) {
            await vscode.window.showErrorMessage(`Model ${alias} not found`);
            return;
        }

        try {
            switch (action) {
                case 'start': {
                    const port = await this._proxyService.startServer(alias, model);
                    await vscode.window.showInformationMessage(
                        `Proxy started for ${alias}\nURL: http://localhost:${port}/v1\nModel: ${model.realModel}`
                    );
                    await this._refreshModels();
                    break;
                }

                case 'stop': {
                    this._proxyService.stopServer(alias);
                    await vscode.window.showInformationMessage(`Server for ${alias} stopped`);
                    await this._refreshModels();
                    break;
                }

                case 'edit': {
                    if (this._view) {
                        await this._view.webview.postMessage({
                            type: 'editModel',
                            model: {
                                alias,
                                ...model
                            }
                        });
                    }
                    break;
                }

                case 'delete': {
                    const answer = await vscode.window.showWarningMessage(
                        `Are you sure you want to delete model ${alias}?`,
                        'Yes',
                        'No'
                    );
                    if (answer === 'Yes') {
                        await this._modelManager.removeModel(alias);
                        if (this._proxyService.isRunning(alias)) {
                            this._proxyService.stopServer(alias);
                        }
                        await vscode.window.showInformationMessage(`Model ${alias} deleted`);
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
            const modelsWithStatus: ModelsWithStatus = Object.entries(models).reduce((acc, [alias, model]) => {
                acc[alias] = {
                    ...model,
                    status: this._proxyService.isRunning(alias) ? 'running' : 'stopped'
                };
                return acc;
            }, {} as ModelsWithStatus);

            await this._view.webview.postMessage({
                type: 'updateModels',
                models: modelsWithStatus
            });
        }
    }
} 