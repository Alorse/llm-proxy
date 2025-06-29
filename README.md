# LLM Proxy

A VSCode extension that proxies LLM requests.

## Features

- Proxies LLM requests to any HTTP-compatible LLM.
- Supports multiple back-ends (Ollama, OpenRouter, custom).
- Allows you to use any LLM with any AI BYOK editor/extension.

## Setup

1. Install the extension.
2. Open the command palette (Ctrl+Shift+P) and run "LLM Proxy: Add Model".
3. Enter an alias for the model (e.g., "gpt-4o").
4. Enter the URL of the LLM endpoint.
5. Enter the real model name (e.g., "llama2").
6. Run "LLM Proxy: Start Proxy".

## Usage

Once the proxy is running, you can use the alias you created in any editor/extension that supports custom LLM endpoints. For example, in Cursor, you would enter `http://localhost:4891/v1` as the API base and `gpt-4o` as the model name.