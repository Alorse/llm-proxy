export function getWebviewContent(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LLM Proxy</title>
        <style>
            body {
                padding: 15px;
            }
            .form-group {
                margin-bottom: 15px;
            }
            label {
                display: block;
                margin-bottom: 5px;
            }
            input {
                width: 100%;
                padding: 5px;
                margin-bottom: 10px;
            }
            button {
                padding: 5px 10px;
                margin-right: 5px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }
            th, td {
                border: 1px solid var(--vscode-editor-foreground);
                padding: 8px;
                text-align: left;
            }
            .status-running {
                color: #4CAF50;
            }
            .status-stopped {
                color: #f44336;
            }
            .hidden {
                display: none;
            }
        </style>
    </head>
    <body>
        <div id="form">
            <input type="hidden" id="modelId">
            <div class="form-group">
                <label for="alias">Model Alias</label>
                <input type="text" id="alias" placeholder="e.g., gpt-4">
            </div>
            <div class="form-group">
                <label for="url">Base URL</label>
                <input type="text" id="url" placeholder="e.g., http://localhost:11434/api">
            </div>
            <div class="form-group">
                <label for="realModel">Real Model Name</label>
                <input type="text" id="realModel" placeholder="e.g., codellama:7b">
            </div>
            <button id="addModel">Add Model</button>
            <button id="cancelEdit" class="hidden">Cancel</button>
        </div>
        <div id="models">
            <table>
                <thead>
                    <tr>
                        <th>Alias</th>
                        <th>Real Model</th>
                        <th>Backend URL</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="modelsList"></tbody>
            </table>
        </div>
        <script>
            (function() {
                const vscode = acquireVsCodeApi();
                let isEditing = false;
                let currentModels = {};

                // Initialize state
                const state = vscode.getState() || { models: {} };
                updateModelsList(state.models);

                function resetForm() {
                    document.getElementById('modelId').value = '';
                    document.getElementById('alias').value = '';
                    document.getElementById('alias').disabled = false;
                    document.getElementById('url').value = '';
                    document.getElementById('realModel').value = '';
                    document.getElementById('addModel').textContent = 'Add Model';
                    document.getElementById('cancelEdit').classList.add('hidden');
                    isEditing = false;
                }

                // Handle form submission
                document.getElementById('addModel').addEventListener('click', () => {
                    const modelId = document.getElementById('modelId').value;
                    const alias = document.getElementById('alias').value;
                    const url = document.getElementById('url').value;
                    const realModel = document.getElementById('realModel').value;

                    if (!alias || !url || !realModel) {
                        vscode.postMessage({
                            type: 'error',
                            message: 'All fields are required'
                        });
                        return;
                    }

                    if (isEditing) {
                        vscode.postMessage({
                            type: 'updateModel',
                            id: modelId,
                            alias,
                            url,
                            realModel
                        });
                    } else {
                        vscode.postMessage({
                            type: 'addModel',
                            alias,
                            url,
                            realModel
                        });
                    }

                    resetForm();
                });

                // Handle cancel edit
                document.getElementById('cancelEdit').addEventListener('click', () => {
                    resetForm();
                });

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'updateModels':
                            currentModels = message.models;
                            vscode.setState({ models: currentModels });
                            updateModelsList(currentModels);
                            break;
                        case 'editModel':
                            // Fill form with model data
                            document.getElementById('modelId').value = message.model.id;
                            document.getElementById('alias').value = message.model.alias;
                            document.getElementById('alias').disabled = false;
                            document.getElementById('url').value = message.model.url;
                            document.getElementById('realModel').value = message.model.realModel;
                            document.getElementById('addModel').textContent = 'Update Model';
                            document.getElementById('cancelEdit').classList.remove('hidden');
                            isEditing = true;
                            break;
                    }
                });

                function updateModelsList(models) {
                    const tbody = document.getElementById('modelsList');
                    tbody.innerHTML = '';

                    for (const [id, model] of Object.entries(models)) {
                        const tr = document.createElement('tr');
                        const status = model.status || 'stopped';
                        const statusText = status === 'running' ? '🟢 Running' : '🔴 Stopped';
                        const actionText = status === 'running' ? 'Stop' : 'Start';
                        
                        tr.innerHTML = \`
                            <td>\${model.alias}</td>
                            <td>\${model.realModel}</td>
                            <td>\${model.url}</td>
                            <td class="status-\${status}">\${statusText}</td>
                            <td>
                                <button onclick="handleAction('\${id}', '\${status === 'running' ? 'stop' : 'start'}')">\${actionText}</button>
                                <button onclick="handleAction('\${id}', 'edit')">Edit</button>
                                <button onclick="handleAction('\${id}', 'delete')">Delete</button>
                            </td>
                        \`;
                        tbody.appendChild(tr);
                    }
                }

                // Global function for handling model actions
                window.handleAction = function(id, action) {
                    vscode.postMessage({
                        type: 'modelAction',
                        id,
                        action
                    });
                };

                // Request initial models list
                vscode.postMessage({ type: 'getModels' });
            })();
        </script>
    </body>
    </html>`;
} 