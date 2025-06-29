import * as vscode from 'vscode';
import { createServer } from './server';
import { Server } from 'http';
import { LlmProxyPanel } from './webview/LlmProxyPanel';

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
    statusBarItem.command = 'llm-proxy.openProxyPanel';
    context.subscriptions.push(statusBarItem);

    context.subscriptions.push(vscode.commands.registerCommand('llm-proxy.startProxy', () => {
        startProxy(context, true);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('llm-proxy.stopProxy', () => {
        stopProxy(true);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('llm-proxy.openProxyPanel', () => {
        LlmProxyPanel.createOrShow(context.extensionUri, context);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('llm-proxy.addModel', () => {
        vscode.commands.executeCommand('llm-proxy.openProxyPanel');
    }));

    context.subscriptions.push(vscode.commands.registerCommand('llm-proxy.removeModel', () => {
        vscode.commands.executeCommand('llm-proxy.openProxyPanel');
    }));

    context.subscriptions.push(vscode.commands.registerCommand('llm-proxy.openSettings', () => {
        vscode.commands.executeCommand('llm-proxy.openProxyPanel');
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