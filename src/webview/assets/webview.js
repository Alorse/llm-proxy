/* global acquireVsCodeApi, document, window, console, setTimeout, setInterval, confirm, URL */

// Enhanced webview with server status and controls
(function() {
    'use strict';

    // Initialize VSCode API
    const vscode = (function() {
        try {
            const api = acquireVsCodeApi();
            return {
                postMessage: api.postMessage,
                getState: () => api.getState() || {},
                setState: api.setState
            };
        } catch (error) {
            console.error('VSCode API unavailable:', error);
            return {
                postMessage: (msg) => console.log('VSCode Simulated:', msg),
                getState: () => ({}),
                setState: () => {}
            };
        }
    })();

    const state = {
        editingAlias: null,
        models: {},
        serverStatus: {}
    };

    const elements = {
        form: document.getElementById('model-form'),
        aliasInput: document.getElementById('alias'),
        urlInput: document.getElementById('url'),
        realModelInput: document.getElementById('realModel'),
        addButton: document.getElementById('add-button'),
        updateButton: document.getElementById('update-button'),
        cancelButton: document.getElementById('cancel-button'),
        modelsTableBody: document.querySelector('#models-table tbody'),
        statusMessage: document.getElementById('status-message')
    };

    // Event listeners setup
    function initEventListeners() {
        elements.form.addEventListener('submit', handleSubmit);
        elements.updateButton.addEventListener('click', handleSubmit);
        elements.cancelButton.addEventListener('click', resetForm);
        elements.modelsTableBody.addEventListener('click', handleTableClick);
    }

    function handleSubmit(event) {
        event.preventDefault();
        if (!validateForm()) return;

        const command = state.editingAlias ? 'updateModel' : 'addModel';
        const alias = state.editingAlias || elements.aliasInput.value.trim();

        vscode.postMessage({
            command: command,
            alias: alias,
            url: elements.urlInput.value.trim(),
            realModel: elements.realModelInput.value.trim()
        });
    }

    function validateForm() {
        const alias = elements.aliasInput.value.trim();
        const url = elements.urlInput.value.trim();
        const realModel = elements.realModelInput.value.trim();

        if (!alias || !url || !realModel) {
            showStatus('All fields are required', true);
            return false;
        }

        try {
            new URL(url);
        } catch {
            showStatus('Invalid URL format', true);
            return false;
        }

        return true;
    }

    function resetForm() {
        state.editingAlias = null;
        elements.form.reset();
        elements.aliasInput.readOnly = false;
        elements.addButton.style.display = 'inline-block';
        elements.updateButton.style.display = 'none';
        elements.cancelButton.style.display = 'none';
    }

    function renderModels(models) {
        state.models = models;
        elements.modelsTableBody.innerHTML = '';
        
        Object.entries(models).forEach(([alias, model]) => {
            const isRunning = state.serverStatus[alias]?.running || false;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${alias}</td>
                <td>${model.url}</td>
                <td>${model.realModel}</td>
                <td>${isRunning ? '🟢 Running' : '🔴 Stopped'}</td>
                <td>
                    <button class="edit-btn" data-alias="${alias}">Edit</button>
                    <button class="control-btn" data-alias="${alias}" data-action="${isRunning ? 'stop' : 'start'}">
                        ${isRunning ? 'Stop' : 'Start'}
                    </button>
                    <button class="delete-btn" data-alias="${alias}">Delete</button>
                </td>
            `;
            elements.modelsTableBody.appendChild(row);
        });
    }

    function handleServerControl(alias, action) {
        vscode.postMessage({
            command: action === 'start' ? 'startServer' : 'stopServer',
            alias: alias,
            url: state.models[alias]?.url
        });
        
        state.serverStatus[alias] = { 
            running: action === 'start',
            lastUpdated: new Date().toISOString()
        };
        renderModels(state.models);
    }

    function handleTableClick(event) {
        const button = event.target.closest('button');
        if (!button) return;

        const alias = button.dataset.alias;
        if (button.classList.contains('edit-btn')) {
            const model = state.models[alias];
            if (model) {
                state.editingAlias = alias;
                elements.aliasInput.value = alias;
                elements.urlInput.value = model.url;
                elements.realModelInput.value = model.realModel;
                elements.aliasInput.readOnly = true;
                elements.addButton.style.display = 'none';
                elements.updateButton.style.display = 'inline-block';
                elements.cancelButton.style.display = 'inline-block';
            }
        } 
        else if (button.classList.contains('control-btn')) {
            handleServerControl(alias, button.dataset.action);
        }
        else if (button.classList.contains('delete-btn')) {
            if (confirm(`Delete model "${alias}"?`)) {
                vscode.postMessage({
                    command: 'removeModel',
                    alias: alias
                });
            }
        }
    }

    function showStatus(message, isError = false) {
        elements.statusMessage.textContent = message;
        elements.statusMessage.className = isError ? 'error' : 'success';
        elements.statusMessage.style.display = 'block';
        setTimeout(() => {
            elements.statusMessage.style.display = 'none';
        }, 5000);
    }

    function init() {
        initEventListeners();
        
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.command === 'updateModels') {
                renderModels(message.models);
                resetForm();
            }
            else if (message.command === 'serverStatus') {
                state.serverStatus = message.status;
                renderModels(state.models);
            }
        });

        vscode.postMessage({ command: 'getModels' });
        vscode.postMessage({ command: 'getServerStatus' });
        
        setInterval(() => {
            vscode.postMessage({ command: 'getServerStatus' });
        }, 10000);
    }

    window.addEventListener('DOMContentLoaded', init);
})();
