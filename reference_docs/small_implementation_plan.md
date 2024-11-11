# Implementation Plan for TTS-STT for Cursor

## Checklist of Steps

1. **Project Initialization**
    - [x] Create the project directory structure.
    - [x] Initialize npm and set up the development environment.
    - [x] Configure TypeScript compiler options.

2. **Set Up Version Control**
    - [x] Initialize a Git repository.
    - [x] Create a `.gitignore` file.

3. **Install Dependencies**
    - [x] Install VS Code extension development dependencies.
    - [x] Install Sherpa-onnx Node.js package.

4. **Create Essential Files**
    - [x] Create the extension manifest (`package.json`).
    - [x] Create the main extension entry point (`extension.ts`).
    - [x] Set up the Webview files (`index.html`, `script.js`, `style.css`).
    - [x] Configure VS Code launch and task configurations.

5. **Implement STT Functionality**
    - [ ] Set up audio input capture in the Webview.
    - [ ] Integrate Sherpa-onnx STT processing in the extension.
    - [ ] Handle transcription results and display them in the IDE.

6. **Implement TTS Functionality**
    - [ ] Capture text input or selection from the user.
    - [ ] Integrate Sherpa-onnx TTS processing in the extension.
    - [ ] Play the synthesized audio in the Webview.

7. **Handle Permissions and Security**
    - [ ] Implement microphone permission requests.
    - [ ] Set up Content Security Policy (CSP) for the Webview.
    - [ ] Ensure data privacy by keeping processing local.

8. **Testing and Debugging**
    - [ ] Test functionality on different operating systems.
    - [ ] Debug any issues and optimize performance.
    - [ ] Validate user experience and interface responsiveness.

9. **Prepare for Distribution**
    - [ ] Update documentation (`README.md`, `CHANGELOG.md`).
    - [ ] Package the extension using `vsce`.
    - [ ] Test the packaged extension installation.

10. **Publish and Maintain**
    - [ ] Publish the extension to the marketplace (if applicable).
    - [ ] Set up a workflow for updates and maintenance.
    - [ ] Engage with users for feedback and improvements.

## Detailed Implementation Steps

### 1. Project Initialization

Establish the foundational directory structure, including directories for configurations, dependencies, compiled outputs, media assets, source code, and documentation. Initialize npm and install TypeScript globally. Configure the TypeScript compiler with appropriate options, ensuring strict type checking and compatibility.

### 2. Set Up Version Control

Initialize a Git repository to manage version control and create a `.gitignore` file to exclude unnecessary files such as `node_modules`, `out`, and `.vscode` directories.

### 3. Install Dependencies

Install the necessary development packages for building VS Code extensions and the Sherpa-onnx Node.js addon to enable STT and TTS functionalities within the extension.


### 4. Create Essential Files

Update the `package.json` file with extension metadata (using package name 'tts-stt-cursor'), activation events, contributions, scripts, and dependencies. Create the main extension entry point, importing required modules and setting up the activation function and command registrations. Develop the webview files, including HTML content for the interface, JavaScript for handling user interactions and communication with the extension, and CSS for styling. Configure VS Code launch and task configurations to facilitate debugging and development.

#### a. Create the Extension Manifest (`package.json`)

Update the existing `package.json` with extension metadata:

```json
{
  "name": "tts-stt-cursor",
  "displayName": "TTS-STT for Cursor",
  "description": "Speech-to-Text and Text-to-Speech capabilities for Cursor IDE",
  "version": "0.0.1",
  "publisher": "gabriel-filincowsky",
  "engines": {
    "vscode": "^1.60.0"
  },
  "categories": ["Other"],
  "activationEvents": ["onCommand:tts-stt-cursor.start"],
  "main": "./out/extension.js",
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "pretest": "npm run compile",
    "test": "node ./out/test/runTest.js"
  },
  "devDependencies": {
    "typescript": "^4.4.3",
    "vscode": "^1.60.0",
    "@types/node": "^14.17.0",
    "@types/vscode": "^1.60.0"
  },
  "dependencies": {
    "sherpa-onnx-node": "^1.0.0"
  },
  "contributes": {
    "commands": [
      {
        "command": "tts-stt-cursor.start",
        "title": "Start TTS-STT for Cursor"
      }
    ]
  }
}
```

#### b. Create the Main Extension Entry Point (`extension.ts`)

In the `src/` directory, create `extension.ts`:

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as sherpa from 'sherpa-onnx-node';

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "TTS-STT for Cursor" is now active.');

  let disposable = vscode.commands.registerCommand('tts-stt-cursor.start', () => {
    vscode.window.showInformationMessage('TTS-STT Extension Started');

    // Initialize Sherpa-onnx
    sherpa.init();

    // Create and show a new webview
    const panel = vscode.window.createWebviewPanel(
      'ttsSttCursor',
      'TTS-STT for Cursor',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, 'media')),
          vscode.Uri.file(path.join(context.extensionPath, 'out'))
        ]
      }
    );

    // Set the webview's HTML content
    panel.webview.html = getWebviewContent(context, panel.webview);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'startSTT':
            await handleSTT(message.audioData);
            break;
          case 'startTTS':
            await handleTTS(message.text);
            break;
        }
      },
      undefined,
      context.subscriptions
    );
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}

// Additional functions to be implemented:
// - getWebviewContent()
// - handleSTT()
// - handleTTS()
```

#### c. Set Up the Webview Files

Create the `webview/` directory inside `src/` and add the following files:

##### i. `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-{{nonce}}'; style-src 'self' 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="style.css" rel="stylesheet">
  <title>TTS-STT for Cursor</title>
</head>
<body>
  <button id="start-stt">🎤 Start STT</button>
  <button id="start-tts">🔊 Start TTS</button>

  <script nonce="{{nonce}}" src="script.js"></script>
</body>
</html>
```

Replace `{{nonce}}` with the generated nonce in `extension.ts`.

##### ii. `script.js`

```javascript
(function () {
  const vscode = acquireVsCodeApi();

  document.getElementById('start-stt').addEventListener('click', () => {
    startSTT();
  });

  document.getElementById('start-tts').addEventListener('click', () => {
    const text = prompt('Enter text for TTS:');
    if (text) {
      vscode.postMessage({ command: 'startTTS', text: text });
    }
  });

  function startSTT() {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        // Implement audio capture and send to extension
      })
      .catch(err => {
        console.error('Error accessing microphone:', err);
      });
  }

  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
      case 'playAudio':
        playAudio(message.audioData);
        break;
    }
  });

  function playAudio(audioData) {
    const audioContext = new AudioContext();
    audioContext.decodeAudioData(audioData, buffer => {
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start(0);
    });
  }
})();
```

##### iii. `style.css`

```css
body {
  font-family: Arial, sans-serif;
  padding: 10px;
}

button {
  margin: 5px;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
}
```

#### d. Configure VS Code Launch and Task Configurations

Create the `.vscode/` directory and add:

##### i. `launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "runtimeExecutable": "${execPath}",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "npm: watch"
    }
  ]
}
```

##### ii. `tasks.json`

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "watch",
      "type": "shell",
      "command": "npm run watch",
      "isBackground": true,
      "presentation": {
        "reveal": "silent"
      },
      "problemMatcher": "$tsc-watch"
    }
  ]
}
```

### 5. Implement STT Functionality

In the webview, set up audio input capture using the Web Audio API, handling user permissions and potential errors. Integrate Sherpa-onnx STT processing in the extension, converting audio data received from the webview into text. Handle the transcription results by displaying them to the user or inserting them into the editor.

### 6. Implement TTS Functionality

Capture text input from the user or obtain selected text from the editor. Integrate Sherpa-onnx TTS processing to synthesize speech from the text input. Send the synthesized audio back to the webview for playback, ensuring smooth and synchronized audio output.

### 7. Handle Permissions and Security

Implement proper permission requests for accessing the microphone, providing clear messages to the user about why permissions are needed. Set up a Content Security Policy for the webview to enhance security and prevent unauthorized content execution. Ensure that all data processing occurs locally, maintaining user privacy and data security.

### 8. Testing and Debugging

Test the extension's functionality across different operating systems, including Windows, macOS, and Linux, to ensure cross-platform compatibility. Use debugging tools to identify and resolve issues, optimizing performance and resource usage. Validate the user experience by ensuring the interface is responsive and provides appropriate feedback during operations.

### 9. Prepare for Distribution

Update documentation, including the README and CHANGELOG files, providing clear installation instructions, feature descriptions, and version history. Package the extension using VSCE, ensuring that all necessary files and assets are included. Test the packaged extension installation in VS Code or Cursor to verify that it installs correctly and functions as intended.

### 10. Publish and Maintain

Publish the extension to the marketplace if applicable, following submission guidelines and providing necessary metadata and assets. Set up a workflow for updates and maintenance, planning for regular updates, bug fixes, and feature enhancements. Engage with users by creating channels for feedback, such as an issue tracker or contact email, to continuously improve the extension based on user input.