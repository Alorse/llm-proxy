import * as vscode from 'vscode';
import { ModelManager, Model } from './data/ModelManager';
import { ModelsPanel } from './webview/ModelsPanel';

let modelManager: ModelManager;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    modelManager = new ModelManager(context);

    // Status bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = 'LLM Proxy: Stopped';
    statusBarItem.tooltip = 'Click to copy the proxy URL to clipboard';
    statusBarItem.command = 'llm-proxy.copyProxyUrl';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Command to copy proxy URL
    const copyProxyUrlCommand = vscode.commands.registerCommand('llm-proxy.copyProxyUrl', async () => {
        const allModels = await modelManager.getAllModels();
        const defaultModel = allModels.find(m => m.default);
        if (!defaultModel) {
            await vscode.window.showWarningMessage('No default model selected');
            return;
        }
        const port = modelManager.getProxyPort(defaultModel.alias);
        if (!port) {
            await vscode.window.showWarningMessage('Default model is not running');
            return;
        }
        const url = `http://localhost:${port}/v1`;
        await vscode.env.clipboard.writeText(url);
        await vscode.window.showInformationMessage(`Proxy URL copied: ${url}`);
    });
    context.subscriptions.push(copyProxyUrlCommand);

    // Register the models view
    const modelsView = vscode.window.registerWebviewViewProvider(
        'llm-proxy-models',
        {
            resolveWebviewView(webviewView: vscode.WebviewView) {
                // Configure webview
                webviewView.webview.options = {
                    enableScripts: true
                };

                // Create and show the panel
                ModelsPanel.createOrShow(context.extensionUri, modelManager, webviewView.webview);

                // Handle visibility changes
                webviewView.onDidChangeVisibility(async () => {
                    if (webviewView.visible) {
                        try {
                            await ModelsPanel.refresh();
                        } catch (error) {
                            console.error('Error refreshing panel:', error);
                            try {
                                await vscode.window.showErrorMessage('Failed to refresh models panel');
                            } catch (err) {
                                console.error('Error showing error message:', err);
                            }
                        }
                    }
                });

                // Handle dispose
                webviewView.onDidDispose(() => {
                    if (ModelsPanel.currentPanel) {
                        ModelsPanel.currentPanel.dispose();
                    }
                });
            }
        },
        {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        }
    );
    context.subscriptions.push(modelsView);

    // Register the add model command
    const addModelCommand = vscode.commands.registerCommand('llm-proxy.addModel', async () => {
        const alias = await vscode.window.showInputBox({
            prompt: 'Enter model alias (e.g., gpt-4o)',
            placeHolder: 'Model alias'
        });
        if (!alias) { return; }

        const url = await vscode.window.showInputBox({
            prompt: 'Enter base URL (e.g., https://api.asi1.ai/v1)',
            placeHolder: 'Base URL'
        });
        if (!url) { return; }

        const realModel = await vscode.window.showInputBox({
            prompt: 'Enter real model name (e.g., asi1-mini)',
            placeHolder: 'Real model name'
        });
        if (!realModel) { return; }

        try {
            await modelManager.addModel(alias, url, realModel);
            await vscode.window.showInformationMessage(`Model ${alias} added successfully`);
            await ModelsPanel.refresh();
            await updateStatusBar();
        } catch (error) {
            await vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to add model');
        }
    });

    // Register the show models command
    const showModelsCommand = vscode.commands.registerCommand('llm-proxy.showModels', async () => {
        // This command is no longer needed as we're using a webview view
        await vscode.window.showInformationMessage('Please use the LLM Proxy view in the activity bar');
    });

    context.subscriptions.push(addModelCommand, showModelsCommand);

    // Al activar, iniciar el modelo default si existe
    startDefaultModelAndStatusBar();
}

async function startDefaultModelAndStatusBar() {
    const allModels = await modelManager.getAllModels();
    const defaultModel = allModels.find(m => m.default);
    if (defaultModel) {
        try {
            await modelManager.startProxy(defaultModel.alias);
            await updateStatusBar();
        } catch (error) {
            await updateStatusBar('Error');
            await vscode.window.showErrorMessage(`Failed to start default model: ${error instanceof Error ? error.message : error}`);
        }
    } else {
        await updateStatusBar('No default');
    }
}

async function updateStatusBar(forceText?: string) {
    const allModels = await modelManager.getAllModels();
    const defaultModel = allModels.find(m => m.default);
    if (!defaultModel) {
        statusBarItem.text = 'LLM Proxy: No default $(clippy)';
        statusBarItem.tooltip = 'Click to copy the proxy URL to clipboard';
        return;
    }
    const isRunning = modelManager.isProxyRunning(defaultModel.alias);
    const port = modelManager.getProxyPort(defaultModel.alias);
    if (forceText) {
        statusBarItem.text = `LLM Proxy: ${forceText} $(clippy)`;
        statusBarItem.tooltip = 'Click to copy the proxy URL to clipboard';
    } else if (isRunning && port) {
        statusBarItem.text = `LLM Proxy: ${defaultModel.alias} (${port}) $(clippy)`;
        statusBarItem.tooltip = `Click to copy: http://localhost:${port}/v1/chat/completions`;
    } else {
        statusBarItem.text = `LLM Proxy: ${defaultModel.alias} (Stopped) $(clippy)`;
        statusBarItem.tooltip = 'Click to copy the proxy URL to clipboard';
    }
}

export async function deactivate() {
    // Stop all running proxies
    if (modelManager) {
        const models = await modelManager.getAllModels();
        await Promise.all(models.map(async (model: Model) => {
            if (modelManager.isProxyRunning(model.alias)) {
                await modelManager.stopProxy(model.alias);
            }
        }));
    }

    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
