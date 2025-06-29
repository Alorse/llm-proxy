import * as vscode from 'vscode';
import { ModelManager } from './data/ModelManager';
import { ProxyService } from './services/ProxyService';
import { ModelsPanel } from './webview/ModelsPanel';

let modelManager: ModelManager;
let proxyService: ProxyService;

export function activate(context: vscode.ExtensionContext) {
    modelManager = new ModelManager(context);
    proxyService = new ProxyService();

    // Create and show webview
    const provider = new ModelsPanel(context.extensionUri, modelManager, proxyService);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ModelsPanel.viewType, provider)
    );
}

export function deactivate() {
    // Stop all running servers
    proxyService.stopAllServers();
}
