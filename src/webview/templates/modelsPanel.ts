interface Model {
    alias: string;
    realModel: string;
    url: string;
    isRunning: boolean;
    port?: number;
    default?: boolean;
}

export const getModelsPanel = (models: Model[]) => {
    
    const getModelHtml = (model: Model) => {
        return `
            <div class="model-container">
                <div class="model-header">${model.alias}
                    <div class="model-header-actions">
                        ${model.default ? '<span style="color: var(--vscode-testing-iconPassed); margin-left: 8px;">(Default)</span>' : ''}
                        ${!model.default ? `<button class="action-button" onclick="window.proxyActions.setDefault('${model.alias}')">Set Default</button>` : ''}
                    </div>
                </div>
                <table>
                    <tr>
                        <td>Status</td>
                        <td>
                            <span class="${model.isRunning ? 'status-running' : 'status-stopped'}">
                                ${model.isRunning ? '● Running' : '○ Stopped'}
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td>Real Model</td>
                        <td>${model.realModel}</td>
                    </tr>
                    <tr>
                        <td>Backend URL</td>
                        <td>${model.url}</td>
                    </tr>
                    ${model.isRunning ? `
                    <tr>
                        <td>Proxy URL</td>
                        <td>http://localhost:${model.port}/v1</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td>Actions</td>
                        <td>
                            ${model.isRunning ? `
                                <button class="action-button" onclick="window.proxyActions.stopProxy('${model.alias}')">Stop Proxy</button>
                            ` : `
                                <button class="action-button" onclick="window.proxyActions.startProxy('${model.alias}')">Start Proxy</button>
                            `}
                            <button class="action-button" onclick="window.proxyActions.editModel('${model.alias}')">Edit</button>
                            <button class="action-button" onclick="window.proxyActions.deleteModel('${model.alias}')">Delete</button>
                        </td>
                    </tr>
                </table>
            </div>
        `;
    };

    return /*html*/`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Models Panel</title>
            <style>
                body {
                    padding: 10px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                }
                .model-container {
                    margin-bottom: 20px;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                }
                .model-header {
                    background-color: var(--vscode-editor-background);
                    padding: 8px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    font-weight: bold;
                }
                .model-header-actions {
                    float: right;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                td {
                    padding: 6px 8px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                td:first-child {
                    width: 120px;
                    font-weight: 500;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                td:last-child {
                    word-break: break-all;
                }
                .status-running {
                    color: var(--vscode-testing-iconPassed);
                }
                .status-stopped {
                    color: var(--vscode-testing-iconFailed);
                }
                .action-button {
                    padding: 4px 8px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 2px;
                    cursor: pointer;
                    margin-right: 4px;
                }
                .action-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .action-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                #no-models {
                    text-align: center;
                    padding: 20px;
                    color: var(--vscode-descriptionForeground);
                }
                .add-model-button {
                    display: block;
                    width: 100%;
                    padding: 8px;
                    margin-bottom: 16px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .add-model-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <button class="add-model-button" onclick="window.proxyActions.addModel()">+ Add New Model</button>
            <div id="models-container">
                ${models.length > 0 ? models.map(getModelHtml).join('') : '<div id="no-models">No models available. Click the button above to add a new model.</div>'}
            </div>
            <script>
                (function() {
                    const vscode = acquireVsCodeApi();
                    
                    // Initialize state with models data
                    const initialState = { models: ${JSON.stringify(models)} };
                    vscode.setState(initialState);

                    // Update the content without reloading
                    function updateContent(models) {
                        const container = document.getElementById('models-container');
                        if (!container) return;

                        if (models.length === 0) {
                            container.innerHTML = '<div id="no-models">No models available. Click the button above to add a new model.</div>';
                            return;
                        }

                        const html = models.map(model => getModelHtml(model)).join('');
                        container.innerHTML = html;
                    }

                    // Define actions in a namespace to avoid global scope pollution
                    window.proxyActions = {
                        startProxy: function(alias) {
                            vscode.postMessage({ type: 'startProxy', alias });
                        },

                        stopProxy: function(alias) {
                            vscode.postMessage({ type: 'stopProxy', alias });
                        },

                        deleteModel: function(alias) {
                            vscode.postMessage({ type: 'deleteModel', alias });
                        },

                        editModel: function(alias) {
                            vscode.postMessage({ type: 'editModel', alias });
                        },

                        addModel: function() {
                            vscode.postMessage({ type: 'addModel' });
                        },

                        setDefault: function(alias) {
                            vscode.postMessage({ type: 'setDefault', alias });
                        }
                    };

                    // Listen for messages from the extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        switch (message.type) {
                            case 'updateModels':
                                vscode.setState({ models: message.models });
                                updateContent(message.models);
                                break;
                        }
                    });

                    // Request initial refresh
                    vscode.postMessage({ type: 'refresh' });

                    // Set up periodic refresh
                    setInterval(() => {
                        vscode.postMessage({ type: 'refresh' });
                    }, 2000);
                })();
            </script>
        </body>
        </html>
    `;
}; 