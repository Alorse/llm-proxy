interface Model {
    alias: string;
    realModel: string;
    url: string;
    isRunning: boolean;
    port?: number;
}

export const getModelsPanel = (models: Model[]) => {
    console.log('Generating panel HTML with models:', models);
    
    const getModelHtml = (model: Model) => {
        console.log('Generating HTML for model:', model);
        return `
            <div class="model-container">
                <div class="model-header">${model.alias}</div>
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
                        <td>http://localhost:${model.port}/v1/chat/completions</td>
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
            </style>
        </head>
        <body>
            <div id="models-container">
                ${models.length > 0 ? models.map(getModelHtml).join('') : '<div id="no-models">No models available. Use the "LLM Proxy: Add Model" command to add a new model.</div>'}
            </div>
            <script>
                (function() {
                    const vscode = acquireVsCodeApi();
                    
                    // Initialize state with models data
                    const initialState = { models: ${JSON.stringify(models)} };
                    vscode.setState(initialState);
                    console.log('Initial state set:', initialState);

                    // Update the content without reloading
                    function updateContent(models) {
                        const container = document.getElementById('models-container');
                        if (!container) return;

                        if (models.length === 0) {
                            container.innerHTML = '<div id="no-models">No models available. Use the "LLM Proxy: Add Model" command to add a new model.</div>';
                            return;
                        }

                        const html = models.map(model => getModelHtml(model)).join('');
                        container.innerHTML = html;
                    }

                    // Define actions in a namespace to avoid global scope pollution
                    window.proxyActions = {
                        startProxy: function(alias) {
                            console.log('Starting proxy for:', alias);
                            vscode.postMessage({ type: 'startProxy', alias });
                        },

                        stopProxy: function(alias) {
                            console.log('Stopping proxy for:', alias);
                            vscode.postMessage({ type: 'stopProxy', alias });
                        },

                        deleteModel: function(alias) {
                            console.log('Deleting model:', alias);
                            vscode.postMessage({ type: 'deleteModel', alias });
                        }
                    };

                    // Listen for messages from the extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        console.log('Received message:', message);
                        
                        switch (message.type) {
                            case 'updateModels':
                                console.log('Updating models:', message.models);
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