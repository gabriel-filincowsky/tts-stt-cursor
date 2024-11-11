# Implementation Plan for TTS-STT for Cursor

## Checklist of Steps

1. **Project Initialization**
   - [ ] Create the project directory structure.
   - [ ] Initialize npm and set up the development environment.
   - [ ] Configure TypeScript compiler options.

2. **Set Up Version Control**
   - [ ] Initialize a Git repository.
   - [ ] Create a `.gitignore` file.

3. **Install Dependencies**
   - [ ] Install VS Code extension development dependencies.
   - [ ] Install Sherpa-onnx Node.js package.

4. **Create Essential Files**
   - [ ] Create the extension manifest (`package.json`).
   - [ ] Create the main extension entry point (`extension.ts`).
   - [ ] Set up the Webview files (`index.html`, `script.js`, `style.css`).
   - [ ] Configure VS Code launch and task configurations.

5. **Implement STT Functionality**
   - [ ] Set up audio input capture in the Webview.
   - [ ] Integrate TTS-STT for Cursor STT processing in the extension.
   - [ ] Handle transcription results and display them in the IDE.

6. **Implement TTS Functionality**
   - [ ] Capture text input or selection from the user.
   - [ ] Integrate TTS-STT for Cursor TTS processing in the extension.
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

---

## Detailed Implementation Steps

### 1. Project Initialization

#### a. Create the Project Directory Structure

I will begin by setting up the foundational directory structure for the extension:

```
tts_stt_cursor/
├── .vscode/
│   ├── launch.json
│   └── tasks.json
├── node_modules/
├── out/
│   └── (compiled JavaScript files)
├── media/
│   ├── icon.png
│   ├── microphone.svg
│   ├── speaker.svg
│   └── (other assets)
├── src/
│   ├── extension.ts
│   ├── webview/
│   │   ├── index.html
│   │   ├── script.js
│   │   └── style.css
│   └── (additional TypeScript files)
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
├── CHANGELOG.md
└── LICENSE
```

#### b. Initialize npm and Set Up the Development Environment

Navigate to the project directory and initialize npm:

```bash
cd tts_stt_cursor
npm init -y
```

Install TypeScript globally if not already installed:

```bash
npm install -g typescript
```

#### c. Configure TypeScript Compiler Options

Create a `tsconfig.json` file in the root directory with the following content:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es6",
    "outDir": "out",
    "rootDir": "src",
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "exclude": ["node_modules", ".vscode"]
}
```

### 2. Set Up Version Control

#### a. Initialize a Git Repository

Initialize Git to manage version control:

```bash
git init
```

#### b. Create a `.gitignore` File

Create a `.gitignore` file to exclude unnecessary files:

```
node_modules/
out/
.vscode/
```

### 3. Install Dependencies

#### a. Install VS Code Extension Development Dependencies

Install the necessary development packages:

```bash
npm install --save-dev typescript @types/node @types/vscode vscode
```

#### b. Install Sherpa-onnx Node.js Package

Install the Sherpa-onnx Node.js addon:

```bash
npm install sherpa-onnx-node
```

### 4. Create Essential Files

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

#### a. Set Up Audio Input Capture in the Webview

In `script.js`, implement the audio capture logic within `startSTT()`:

```javascript
function startSTT() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onload = () => {
          const arrayBuffer = reader.result;
          vscode.postMessage({ command: 'startSTT', audioData: arrayBuffer });
        };
        reader.readAsArrayBuffer(audioBlob);
      };

      mediaRecorder.start();

      setTimeout(() => {
        mediaRecorder.stop();
      }, 5000); // Record for 5 seconds
    })
    .catch(err => {
      console.error('Error accessing microphone:', err);
    });
}
```

#### b. Integrate TTS-STT for Cursor STT Processing in the Extension

In `extension.ts`, implement `handleSTT()`:

```typescript
async function handleSTT(audioData: ArrayBuffer) {
  // Convert ArrayBuffer to appropriate format for Sherpa-onnx
  const audioBuffer = Buffer.from(audioData);

  // Process audio with Sherpa-onnx
  const transcription = await sherpa.stt(audioBuffer);

  // Send the transcription back to the webview or insert into the editor
  vscode.window.showInformationMessage(`Transcription: ${transcription}`);
}
```

#### c. Handle Transcription Results and Display Them in the IDE

Decide whether to insert the transcribed text into the active editor or display it in a message. Modify `handleSTT()` accordingly.

### 6. Implement TTS Functionality

#### a. Capture Text Input or Selection from the User

In the webview, the user inputs text via a prompt. Alternatively, capture selected text from the editor.

#### b. Integrate TTS-STT for Cursor TTS Processing in the Extension

In `extension.ts`, implement `handleTTS()`:

```typescript
async function handleTTS(text: string) {
  // Process text with Sherpa-onnx TTS
  const audioBuffer = await sherpa.tts(text);

  // Send the audio data back to the webview for playback
  panel.webview.postMessage({ command: 'playAudio', audioData: audioBuffer });
}
```

#### c. Play the Synthesized Audio in the Webview

In `script.js`, handle the `playAudio` command as previously implemented.

### 7. Handle Permissions and Security

#### a. Implement Microphone Permission Requests

Ensure that the webview properly requests microphone access and handles user denial gracefully.

#### b. Set Up Content Security Policy (CSP) for the Webview

In `extension.ts`, when setting the HTML content, include a nonce and define a strict CSP:

```typescript
function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  const nonce = getNonce();
  // Replace '{{nonce}}' in index.html with the generated nonce
  // Set CSP in the HTML head
}
```

#### c. Ensure Data Privacy by Keeping Processing Local

Confirm that all data processing occurs locally and no data is sent to external servers.

### 8. Testing and Debugging

#### a. Test Functionality on Different Operating Systems

Test the extension on Windows, macOS, and Linux to ensure compatibility.

#### b. Debug Any Issues and Optimize Performance

Use VS Code's debugging tools to step through code and resolve any issues.

#### c. Validate User Experience and Interface Responsiveness

Ensure the UI is intuitive and responsive, with appropriate feedback during processing.

### 9. Prepare for Distribution

#### a. Update Documentation (`README.md`, `CHANGELOG.md`)

Provide clear instructions, feature descriptions, and update logs.

#### b. Package the Extension Using `vsce`

Install `vsce` if not already installed:

```bash
npm install -g @vscode/vsce
```

Package the extension:

```bash
vsce package
```

#### c. Test the Packaged Extension Installation

Install the generated `.vsix` file in VS Code or Cursor to ensure it installs and runs correctly.

### 10. Publish and Maintain

#### a. Publish the Extension to the Marketplace (If Applicable)

Follow the marketplace's guidelines to publish the extension, providing necessary metadata and assets.

#### b. Set Up a Workflow for Updates and Maintenance

Plan for regular updates, bug fixes, and feature enhancements.

#### c. Engage with Users for Feedback and Improvements

Create channels for user feedback, such as a repository issue tracker or email.
