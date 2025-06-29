export function getWebviewContent() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLM Proxy Management</title>
    <link href="\${vscode-resource:/src/webview/assets/main.css}" rel="stylesheet">
</head>
<body>
    <h1>LLM Proxy Management</h1>

    <form id="model-form">
        <label for="alias">Alias:</label>
        <input type="text" id="alias" name="alias" placeholder="e.g., gpt-4o-alias" required><br><br>

        <label for="url">URL:</label>
        <input type="text" id="url" name="url" placeholder="e.g., http://localhost:8080/v1/chat/completions" required><br><br>

        <label for="realModel">Real Model:</label>
        <input type="text" id="realModel" name="realModel" placeholder="e.g., llama3" required><br><br>

        <button type="submit" id="add-button">Add Model</button>
        <button type="button" id="update-button" style="display:none;">Update Model</button>
        <button type="button" id="cancel-button" style="display:none;">Cancel</button>
    </form>

    <h2>Existing Models</h2>
    <table id="models-table">
        <thead>
            <tr>
                <th>Alias</th>
                <th>URL</th>
                <th>Real Model</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            <!-- Models will be inserted here by JavaScript -->
        </tbody>
    </table>

    <script nonce="\${nonce}" src="\${vscode-resource:/src/webview/assets/webview.js}"></script>
</body>
</html>`;
}