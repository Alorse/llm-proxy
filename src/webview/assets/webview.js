const vscode = acquireVsCodeApi();

const form = document.getElementById('model-form') as HTMLFormElement;
const aliasInput = document.getElementById('alias') as HTMLInputElement;
const urlInput = document.getElementById('url') as HTMLInputElement;
const realModelInput = document.getElementById('realModel') as HTMLInputElement;
const addButton = document.getElementById('add-button') as HTMLButtonElement;
const updateButton = document.getElementById('update-button') as HTMLButtonElement;
const cancelButton = document.getElementById('cancel-button') as HTMLButtonElement;
const modelsTableBody = document.querySelector('#models-table tbody') as HTMLTableSectionElement;

let editingAlias: string | null = null;

function renderModels(models: { [key: string]: { url: string; realModel: string } }) {
    modelsTableBody.innerHTML = '';
    for (const alias in models) {
        const model = models[alias];
        const row = modelsTableBody.insertRow();
        row.insertCell().textContent = alias;
        row.insertCell().textContent = model.url;
        row.insertCell().textContent = model.realModel;

        const actionsCell = row.insertCell();
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.onclick = () => startEdit(alias, model.url, model.realModel);
        actionsCell.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = () => deleteModel(alias);
        actionsCell.appendChild(deleteButton);
    }
}

function startEdit(alias: string, url: string, realModel: string) {
    editingAlias = alias;
    aliasInput.value = alias;
    urlInput.value = url;
    realModelInput.value = realModel;

    addButton.style.display = 'none';
    updateButton.style.display = 'inline-block';
    cancelButton.style.display = 'inline-block';
    aliasInput.readOnly = true; // Prevent changing alias during edit
}

function cancelEdit() {
    editingAlias = null;
    form.reset();
    addButton.style.display = 'inline-block';
    updateButton.style.display = 'none';
    cancelButton.style.display = 'none';
    aliasInput.readOnly = false;
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const alias = aliasInput.value;
    const url = urlInput.value;
    const realModel = realModelInput.value;

    if (editingAlias) {
        vscode.postMessage({
            command: 'updateModel',
            alias: editingAlias,
            url,
            realModel
        });
    } else {
        vscode.postMessage({
            command: 'addModel',
            alias,
            url,
            realModel
        });
    }
    cancelEdit();
});

updateButton.addEventListener('click', () => {
    form.dispatchEvent(new Event('submit'));
});

cancelButton.addEventListener('click', cancelEdit);

function deleteModel(alias: string) {
    vscode.postMessage({
        command: 'removeModel',
        alias
    });
}

// Handle messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'updateModels':
            renderModels(message.models);
            break;
    }
});

// Request initial models when the webview is loaded
vscode.postMessage({ command: 'getModels' });