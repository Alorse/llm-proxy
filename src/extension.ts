import * as vscode from 'vscode';
import { createServer } from './server';
import { Server } from 'http';

let server: Server | null = null;
let statusBarItem: vscode.StatusBarItem;

function startProxy(context: vscode.ExtensionContext, showMessage = false) {
    if (!server) {
        server = createServer(context);
        updateStatusBar(true);
        if (showMessage) {
            vscode.window.showInformationMessage('LLM Proxy started.');
        }
    } else {
        if (showMessage) {
            vscode.window.showInformationMessage('LLM Proxy is already running.');
        }
    }
}

function stopProxy(showMessage = false) {
    if (server) {
        server.close();
        server = null;
        updateStatusBar(false);
        if (showMessage) {
            vscode.window.showInformationMessage('LLM Proxy stopped.');
        }
    } else {
        if (showMessage) {
            vscode.window.showInformationMessage('LLM Proxy is not running.');
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'llm-proxy.openSettings';
    context.subscriptions.push(statusBarItem);

    context.subscriptions.push(vscode.commands.registerCommand('llm-proxy.startProxy', () => {
        startProxy(context, true);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('llm-proxy.stopProxy', () => {
        stopProxy(true);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('llm-proxy.addModel', async () => {
        const alias = await vscode.window.showInputBox({ prompt: 'Enter a unique alias for the model (e.g., gpt-4o)' });
        if (!alias) return;

        const url = await vscode.window.showInputBox({ prompt: 'Enter the full URL of the LLM endpoint' });
        if (!url) return;

        const realModel = await vscode.window.showInputBox({ prompt: 'Enter the real model name (e.g., llama3)' });
        if (!realModel) return;

        const models = context.globalState.get<{[key: string]: {url: string, realModel: string}}>('llm-proxy.models', {});
        models[alias] = { url, realModel };
        await context.globalState.update('llm-proxy.models', models);
        vscode.window.showInformationMessage(`Model '${alias}' added.`);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('llm-proxy.removeModel', async () => {
        const models = context.globalState.get<{[key: string]: {url: string, realModel: string}}>('llm-proxy.models', {});
        const modelAliases = Object.keys(models);

        if (modelAliases.length === 0) {
            vscode.window.showInformationMessage('No models to remove.');
            return;
        }

        const aliasToRemove = await vscode.window.showQuickPick(modelAliases, { placeHolder: 'Select a model to remove' });
        if (aliasToRemove) {
            delete models[aliasToRemove];
            await context.globalState.update('llm-proxy.models', models);
            vscode.window.showInformationMessage(`Model '${aliasToRemove}' removed.`);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('llm-proxy.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'llm-proxy');
    }));

    startProxy(context, false);
}

export function deactivate() {
    if (server) {
        server.close();
    }
}

function updateStatusBar(isRunning: boolean) {
    if (isRunning) {
        statusBarItem.text = '$(rocket) LLM Proxy';
        statusBarItem.tooltip = 'LLM Proxy is running';
    } else {
        statusBarItem.text = '$(stop-circle) LLM Proxy';
        statusBarItem.tooltip = 'LLM Proxy is stopped';
    }
    statusBarItem.show();
}