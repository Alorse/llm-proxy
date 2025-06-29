import * as vscode from 'vscode';
import { getWebviewContent } from './htmlContent';
import { ModelManager } from '../data/ModelManager';

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
        // Use VS Code's globalState for persistence instead of webview.state
        this._modelManager = new ModelManager(this._extensionContext);

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                console.log('LlmProxyPanel: Message received from webview:', message);
                switch (message.command) {
                    case 'addModel':
                        await this._modelManager.addModel(message.alias, message.url, message.realModel);
                        this._postModels();
                        return;
                    case 'removeModel':
                        await this._modelManager.removeModel(message.alias);
                        this._postModels();
                        return;
                    case 'updateModel':
                        await this._modelManager.updateModel(message.alias, message.url, message.realModel);
                        this._postModels();
                        return;
                    case 'getModels':
                        this._postModels();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        console.log('LlmProxyPanel: Disposing panel.');
        LlmProxyPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _postModels() {
        const models = await this._modelManager.getModels();
        console.log('LlmProxyPanel: Posting models to webview:', models);
        this._panel.webview.postMessage({ command: 'updateModels', models: models });
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = 'LLM Proxy Management';

        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'assets', 'webview.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'assets', 'main.css'));

        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();

        this._panel.webview.html = getWebviewContent()
            .replace('${vscode-resource:/src/webview/assets/main.css}', styleUri.toString())
            .replace('${vscode-resource:/src/webview/assets/webview.js}', scriptUri.toString())
            .replace('${nonce}', nonce);
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