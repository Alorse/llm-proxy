import * as vscode from 'vscode';
import { getWebviewContent } from './htmlContent';
import { ModelManager } from '../data/ModelManager';

interface WebviewMessage {
    command: string;
    alias?: string;
    url?: string;
    realModel?: string;
    [key: string]: any;
}

export class LlmProxyPanel {
    public static currentPanel: LlmProxyPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _extensionContext: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];
    private _modelManager: ModelManager;

    public static createOrShow(extensionUri: vscode.Uri, extensionContext: vscode.ExtensionContext) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (LlmProxyPanel.currentPanel) {
            LlmProxyPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'llmProxyPanel',
            'LLM Proxy Management',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        LlmProxyPanel.currentPanel = new LlmProxyPanel(panel, extensionUri, extensionContext);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, extensionContext: vscode.ExtensionContext) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._extensionContext = extensionContext;
        this._modelManager = new ModelManager(this._extensionContext);

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            (message: WebviewMessage) => this._handleMessage(message),
            null,
            this._disposables
        );
    }

    public dispose() {
        LlmProxyPanel.currentPanel = undefined;
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _handleMessage(message: WebviewMessage) {
        try {
            console.log('Message received:', message);
            
            switch (message.command) {
                case 'addModel':
                    await this._addModelHandler(message);
                    break;
                case 'removeModel':
                    await this._removeModelHandler(message);
                    break;
                case 'updateModel':
                    await this._updateModelHandler(message);
                    break;
                case 'getModels':
                    await this._getModelsHandler();
                    break;
                case 'startServer':
                    await this._startServerHandler(message);
                    break;
                case 'stopServer':
                    await this._stopServerHandler(message);
                    break;
                case 'getServerStatus':
                    await this._getServerStatusHandler();
                    break;
                default:
                    throw new Error(`Unknown command: ${message.command}`);
            }
        } catch (error: unknown) {
            console.error('Error handling message:', error);
            this._panel.webview.postMessage({
                command: 'error',
                text: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async _addModelHandler(message: WebviewMessage) {
        await this._modelManager.addModel(message.alias!, message.url!, message.realModel!);
        await this._postModels();
    }

    private async _removeModelHandler(message: WebviewMessage) {
        await this._modelManager.removeModel(message.alias!);
        await this._postModels();
    }

    private async _updateModelHandler(message: WebviewMessage) {
        await this._modelManager.updateModel(message.alias!, message.url!, message.realModel!);
        await this._postModels();
    }

    private async _getModelsHandler() {
        await this._postModels();
    }

    private async _startServerHandler(message: WebviewMessage) {
        const startStatus = await this._modelManager.startServer(message.alias!);
        await this._postServerStatus();
        this._panel.webview.postMessage({
            command: 'serverStarted',
            alias: message.alias,
            url: startStatus.localUrl
        });
    }

    private async _stopServerHandler(message: WebviewMessage) {
        await this._modelManager.stopServer(message.alias!);
        await this._postServerStatus();
        this._panel.webview.postMessage({
            command: 'serverStopped',
            alias: message.alias
        });
    }

    private async _getServerStatusHandler() {
        await this._postServerStatus();
    }

    private async _postModels() {
        const models = await this._modelManager.getModels();
        this._panel.webview.postMessage({ command: 'updateModels', models });
    }

    private async _postServerStatus() {
        const status = await this._modelManager.getServerStatus();
        this._panel.webview.postMessage({ 
            command: 'serverStatus', 
            status,
            localEndpoints: status
        });
    }

    private _update() {
        const webview = this._panel.webview;
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'assets', 'webview.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'assets', 'main.css')
        );

        this._panel.webview.html = getWebviewContent()
            .replace('${scriptUri}', scriptUri.toString())
            .replace('${styleUri}', styleUri.toString())
            .replace('${nonce}', getNonce());
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}