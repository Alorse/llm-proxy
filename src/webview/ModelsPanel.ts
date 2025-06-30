import * as vscode from 'vscode';
import { getModelsPanel } from './templates/modelsPanel';
import { ModelManager } from '../data/ModelManager';

interface WebviewMessage {
    type: string;
    alias?: string;
}

export class ModelsPanel {
    public static currentPanel: ModelsPanel | undefined;
    private readonly _webview: vscode.Webview;
    private _disposables: vscode.Disposable[] = [];
    private _modelManager: ModelManager;
    private _extensionUri: vscode.Uri;

    private constructor(webview: vscode.Webview, modelManager: ModelManager, extensionUri: vscode.Uri) {
        this._webview = webview;
        this._modelManager = modelManager;
        this._extensionUri = extensionUri;

        console.log('ModelsPanel constructor called');

        // Configure webview
        this._webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        // Set the webview's initial html content
        this._update().then(() => {
            console.log('Initial update completed');
        }).catch(error => {
            console.error('Error in initial update:', error);
        });

        // Handle messages from the webview
        this._webview.onDidReceiveMessage(
            async (message: WebviewMessage) => {
                console.log('Received message:', message);
                try {
                    switch (message.type) {
                        case 'refresh':
                            await this._update();
                            break;
                        case 'startProxy': {
                            if (message.alias) {
                                const model = await this._modelManager.getModel(message.alias);
                                if (model) {
                                    await this._modelManager.startProxy(message.alias);
                                    await this._update();
                                }
                            }
                            break;
                        }
                        case 'stopProxy': {
                            if (message.alias) {
                                await this._modelManager.stopProxy(message.alias);
                                await this._update();
                            }
                            break;
                        }
                        case 'deleteModel': {
                            if (message.alias) {
                                await this._modelManager.deleteModel(message.alias);
                                await this._update();
                            }
                            break;
                        }
                        case 'editModel': {
                            if (message.alias) {
                                const model = await this._modelManager.getModel(message.alias);
                                if (model) {
                                    const alias = await vscode.window.showInputBox({
                                        prompt: 'Enter model alias',
                                        value: model.alias,
                                        validateInput: text => {
                                            return text && text.length > 0 ? null : 'Alias is required';
                                        }
                                    });
                                    if (!alias) { return; }

                                    const realModel = await vscode.window.showInputBox({
                                        prompt: 'Enter real model name',
                                        value: model.realModel,
                                        validateInput: text => {
                                            return text && text.length > 0 ? null : 'Real model name is required';
                                        }
                                    });
                                    if (!realModel) { return; }

                                    const url = await vscode.window.showInputBox({
                                        prompt: 'Enter backend URL',
                                        value: model.url,
                                        validateInput: text => {
                                            try {
                                                new URL(text);
                                                return null;
                                            } catch {
                                                return 'Please enter a valid URL';
                                            }
                                        }
                                    });
                                    if (!url) { return; }

                                    await this._modelManager.updateModel(model.id, alias, url, realModel);
                                    await this._update();
                                }
                            }
                            break;
                        }
                        case 'addModel': {
                            const alias = await vscode.window.showInputBox({
                                prompt: 'Enter model alias',
                                validateInput: text => {
                                    return text && text.length > 0 ? null : 'Alias is required';
                                }
                            });
                            if (!alias) { return; }

                            const realModel = await vscode.window.showInputBox({
                                prompt: 'Enter real model name',
                                validateInput: text => {
                                    return text && text.length > 0 ? null : 'Real model name is required';
                                }
                            });
                            if (!realModel) { return; }

                            const url = await vscode.window.showInputBox({
                                prompt: 'Enter backend URL',
                                validateInput: text => {
                                    try {
                                        new URL(text);
                                        return null;
                                    } catch {
                                        return 'Please enter a valid URL';
                                    }
                                }
                            });
                            if (!url) { return; }

                            await this._modelManager.addModel(alias, url, realModel);
                            await this._update();
                            break;
                        }
                        case 'setDefault': {
                            if (message.alias) {
                                const model = await this._modelManager.getModel(message.alias);
                                if (model) {
                                    await this._modelManager.updateModel(model.id, model.alias, model.url, model.realModel, true);
                                    await this._update();
                                }
                            }
                            break;
                        }
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
                    console.error('Error handling message:', error);
                    await vscode.window.showErrorMessage(errorMessage);
                }
            },
            undefined,
            this._disposables
        );

        // Update the content every 2 seconds
        setInterval(() => {
            this._update().catch(error => {
                console.error('Error in periodic update:', error);
            });
        }, 2000);
    }

    public static createOrShow(extensionUri: vscode.Uri, modelManager: ModelManager, webview: vscode.Webview) {
        console.log('createOrShow called');
        
        // If we already have a panel, dispose it
        if (ModelsPanel.currentPanel) {
            ModelsPanel.currentPanel.dispose();
        }

        ModelsPanel.currentPanel = new ModelsPanel(webview, modelManager, extensionUri);
        console.log('New panel created');
    }

    public static async refresh() {
        if (ModelsPanel.currentPanel) {
            await ModelsPanel.currentPanel._update();
        }
    }

    private async _update() {
        console.log('_update called');
        try {
            const models = await this._modelManager.getAllModels();
            console.log('Retrieved models:', models);

            const modelsWithStatus = models.map(model => ({
                ...model,
                isRunning: this._modelManager.isProxyRunning(model.alias),
                port: this._modelManager.getProxyPort(model.alias)
            }));
            console.log('Models with status:', modelsWithStatus);

            // Set initial HTML
            const html = getModelsPanel(modelsWithStatus);
            this._webview.html = html;
            console.log('HTML updated');

            // Post message to update the view
            await this._webview.postMessage({ type: 'updateModels', models: modelsWithStatus });
            console.log('Update message posted');
        } catch (error) {
            console.error('Error updating webview:', error);
            this._webview.html = getModelsPanel([]);
        }
    }

    public dispose() {
        console.log('dispose called');
        ModelsPanel.currentPanel = undefined;

        // Clean up our resources
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
} 