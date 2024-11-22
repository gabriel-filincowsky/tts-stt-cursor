# Project Description Starting Point

## Introduction

The objective of this project is to develop a Visual Studio Code (VS Code) extension that integrates the **Sherpa-onnx** framework to provide **speech-to-text (STT)** and **text-to-speech (TTS)** functionalities within the **Cursor IDE** (a modern fork of VS Code). By leveraging Sherpa-onnx's Node.js integration, we aim to create an extension that allows users to interact with the IDE using voice commands and receive auditory feedback, enhancing accessibility, productivity, and the overall user experience.

The extension will enable users to:

- **Convert spoken words into text** within the editor (STT).
- **Read selected text or outputs aloud** (TTS).
- **Interact with the IDE's chat interface** using voice input and output.

By directly integrating Sherpa-onnx into the extension, we eliminate the need for external processes or servers, simplifying the user setup and improving performance. This document outlines the implementation plan, detailing the steps required to develop, test, and package the extension for distribution.

---

## Implementation Plan

### 1. Leveraging Sherpa-onnx Node.js Integration

Sherpa-onnx offers two primary methods for integration with Node.js:

- **Node.js Addon (C++ Addon):**

  - **Advantages:**
    - Efficient execution with native performance.
    - Support for multi-threading.
  - **Considerations:**
    - Requires handling native binaries for different platforms.
    - Must ensure compatibility with the Node.js version used by VS Code (Electron's Node.js version).

- **WebAssembly (WASM):**

  - **Advantages:**
    - Runs in any environment that supports WebAssembly.
    - Simplifies distribution without platform-specific binaries.
  - **Considerations:**
    - Potential limitations with multi-threading, affecting performance.
    - May have performance overhead compared to native addons.

**Decision:** We will prioritize the **Node.js Addon** for its native performance benefits. However, we will consider WASM as a fallback option if necessary.

### 2. Updated Extension Development Strategy

- **Direct Integration:**

  - Import and use Sherpa-onnx directly within the extension's TypeScript code.
  - Eliminate the need for external Python servers or applications.

- **Simplify User Experience:**

  - Bundle all necessary dependencies within the extension.
  - Ensure that the extension works out-of-the-box after installation, with minimal user setup.

### 3. Adjusted Implementation Steps

#### **Step 1: Set Up Development Environment**

**Prerequisites:**

- **Node.js** (version 16 or higher).
- **npm** (comes with Node.js).
- **TypeScript** installed globally:

  ```bash
  npm install -g typescript
  ```

- **Visual Studio Code** for development and testing.

**Initialize the Extension Project:**

- Create a new directory for the extension:

  ```bash
  mkdir tts_stt_cursor
  cd tts_stt_cursor
  ```

- Initialize npm:

  ```bash
  npm init -y
  ```

- Install VS Code extension development dependencies:

  ```bash
  npm install --save-dev typescript @types/node @types/vscode vscode
  ```

#### **Step 2: Install Sherpa-onnx Packages**

- **For Node.js Addon:**

  ```bash
  npm install sherpa-onnx-node
  ```

- **Set Environment Variables (if required):**

  - For native addons, ensure that the dynamic library paths are correctly set.
  - On macOS, for example:

    ```bash
    export DYLD_LIBRARY_PATH=$PWD/node_modules/sherpa-onnx-darwin-x64:$DYLD_LIBRARY_PATH
    ```

#### **Step 3: Implement STT Functionality**

- **Audio Input Capture:**

  - Use the **Webview API** to create a webview panel that captures audio using the **Web Audio API**.
  - Request microphone access in the webview:

    ```javascript
    navigator.mediaDevices.getUserMedia({ audio: true })
    ```

- **Audio Processing with Sherpa-onnx:**

  - In **TypeScript**:

    ```typescript
    import * as sherpa from 'sherpa-onnx-node';

    // Initialize Sherpa-onnx
    sherpa.init();

    // Process audio data
    sherpa.processAudio(audioBuffer, (transcription: string) => {
      // Handle the transcribed text
    });
    ```

- **Integration with Cursor's UI:**

  - Display the transcribed text in the chat interface.
  - Allow users to interact with the LLM backend using voice input.

#### **Step 4: Implement TTS Functionality**

- **Text Retrieval:**

  - Capture text from the chat output or user selection.

- **Speech Synthesis:**

  - In **TypeScript**:

    ```typescript
    sherpa.textToSpeech(textInput, (audioBuffer: ArrayBuffer) => {
      // Play the generated audio
    });
    ```

- **Audio Playback:**

  - Use the Web Audio API or HTML5 `<audio>` element in the webview to play audio:

    ```javascript
    const audioContext = new AudioContext();
    audioContext.decodeAudioData(audioBuffer, (buffer) => {
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start(0);
    });
    ```

#### **Step 5: Handle Permissions and Security**

- **Microphone and Audio Access:**

  - Ensure that the webview requests and handles permissions appropriately.
  - Inform users about the necessity of permissions and assure them about data privacy.

- **Data Privacy:**

  - All processing is done locally on the user's machine.
  - No user data is collected or transmitted externally.

#### **Step 6: Testing and Optimization**

- **Cross-Platform Testing:**

  - Test the extension on **Windows**, **macOS**, and **Linux**.
  - Ensure that native binaries work correctly on all platforms.

- **Performance Optimization:**

  - Evaluate the latency of STT and TTS processing.
  - Optimize audio data handling and Sherpa-onnx configurations.

- **User Experience:**

  - Ensure that the UI is responsive.
  - Provide feedback during processing (e.g., loading indicators).

---

## Project Structure and Development Environment

### 4. Project Directory Structure

Organize the project's files and folders for maintainability:

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

**Key Files and Folders:**

- **.vscode/**: VS Code configurations for debugging and tasks.
- **node_modules/**: Node.js dependencies.
- **out/**: Compiled JavaScript files after building TypeScript code.
- **media/**: Static assets like images and icons.
- **src/**: TypeScript source code.
  - **extension.ts**: Main entry point.
  - **webview/**: Webview interface files.
- **.gitignore**: Files/directories to be ignored by Git.
- **package.json**: Extension metadata, scripts, and dependencies.
- **tsconfig.json**: TypeScript compiler configuration.
- **README.md**: Extension description.
- **CHANGELOG.md**: Version changes.
- **LICENSE**: Licensing terms.

### 5. Development Environment Setup

**Prerequisites:**

- **Node.js** and **npm**.
- **Visual Studio Code**.
- **TypeScript** installed globally.

**Setting Up the Project:**

1. **Create Project Directory:**

   ```bash
   mkdir tts_stt_cursor
   cd tts_stt_cursor
   ```

2. **Initialize npm and Install Dependencies:**

   ```bash
   npm init -y
   npm install --save-dev typescript @types/node @types/vscode vscode
   npm install sherpa-onnx-node
   ```

3. **Set Up TypeScript Configuration (`tsconfig.json`):**

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

4. **Create `.vscode` Configurations:**

   - **.vscode/launch.json**:

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

   - **.vscode/tasks.json**:

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

5. **Update `package.json`:**

   ```json
   {
     "name": "tts-stt-cursor",
     "displayName": "TTS-STT for Cursor",
     "description": "Speech-to-text and text-to-speech functionalities for Cursor IDE",
     "version": "0.0.1",
     "publisher": "your-name",
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

---

## Implementing Extension Functionality

### 6. Extension Entry Point (`extension.ts`)

**Import Modules:**

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as sherpa from 'sherpa-onnx-node';
```

**Activate Function:**

```typescript
export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "TTS-STT for Cursor" is now active.');

  let disposable = vscode.commands.registerCommand('tts-stt-cursor.start', () => {
    vscode.window.showInformationMessage('TTS-STT for Cursor Started');

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
            // Handle STT functionality
            await handleSTT(message.audioData);
            break;
          case 'startTTS':
            // Handle TTS functionality
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

// Additional functions: getWebviewContent, getNonce, handleSTT, handleTTS
```

### 7. Webview Implementation

**Webview HTML Content (`index.html`):**

- Include microphone and speaker icons.
- Link to the webview's script and styles.

**Webview Script (`script.js`):**

```javascript
(function () {
  const vscode = acquireVsCodeApi();

  document.getElementById('start-stt').addEventListener('click', () => {
    // Capture audio and send to the extension
    startSTT();
  });

  document.getElementById('start-tts').addEventListener('click', () => {
    // Get text input and send to the extension
    const text = prompt('Enter text for TTS:');
    if (text) {
      vscode.postMessage({ command: 'startTTS', text: text });
    }
  });

  function startSTT() {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        // Process audio stream and send to the extension
        // Implementation of audio capture and processing
      })
      .catch(err => {
        console.error('Error accessing microphone:', err);
      });
  }

  // Handle messages from the extension
  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
      case 'playAudio':
        // Play audio data sent from the extension
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

**Webview Styles (`style.css`):**

```css
body {
  font-family: Arial, sans-serif;
  padding: 10px;
}
button {
  margin: 5px;
  padding: 10px 20px;
  font-size: 16px;
}
```

---

## Testing and Packaging

### 8. Testing

**Run Extension in VS Code:**

- Use the **Run Extension** launch configuration in **launch.json**.

**Debugging:**

- Set breakpoints in TypeScript code.
- Use `console.log` for debug information.

**User Testing:**

- Test all functionalities from a user's perspective.
- Ensure permissions are correctly requested and handled.

### 9. Packaging and Sharing the Extension

**Install VSCE (Visual Studio Code Extension Manager):**

```bash
npm install -g @vscode/vsce
```

**Prepare the Extension for Packaging:**

- Ensure all necessary files are included.
- Update version numbers and metadata in `package.json`.

**Create a VSIX Package:**

```bash
vsce package
```

- Generates a `.vsix` file (e.g., `tts-stt-cursor-0.0.1.vsix`).

**Test Installation:**

- Open VS Code or Cursor.
- Install the extension from the `.vsix` file via the **Extensions: Install from VSIX...** command.

**Sharing the Extension:**

- **Direct Distribution:**

  - Share the `.vsix` file directly with users.
  - Provide installation instructions.

- **Publishing to Marketplace:**

  - If Cursor supports a marketplace, publish the extension there.
  - For VS Code, publish to the [Visual Studio Marketplace](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).
  - Follow the publishing guidelines and create a publisher account if necessary.

---

## Potential Challenges and Solutions

### **Challenge 1: Handling Native Modules**

- **Issue:**

  - Native Node.js addons require compilation or pre-built binaries for each platform.

- **Solution:**

  - **Pre-built Binaries:**

    - Use pre-built binaries provided by Sherpa-onnx for different platforms.
    - Include these binaries in the extension package.

  - **Node.js Version Compatibility:**

    - Ensure compatibility with the Node.js version used by VS Code (Electron's Node.js version).
    - Use `node-abi` to match the correct Node.js and Electron versions.

### **Challenge 2: WebAssembly Limitations**

- **Issue:**

  - WASM might have limited support for multi-threading, affecting performance.

- **Solution:**

  - **Performance Testing:**

    - Test the WASM implementation to evaluate performance.

  - **Fallback Mechanism:**

    - Use WASM as a fallback if native addons cannot be used.
    - Inform users about potential performance differences.

### **Challenge 3: Audio Handling in Webview**

- **Issue:**

  - Capturing and playing audio within the webview securely and efficiently.

- **Solution:**

  - **Efficient Data Transfer:**

    - Use message passing between the extension and webview for audio data.
    - Consider encoding audio data to reduce size.

  - **Security Practices:**

    - Ensure the webview content is secure.
    - Use **Content Security Policy (CSP)** to restrict webview content.

---

## Overview of the End Product

**Functionality:**

- **STT (Speech-to-Text):**

  - Users click a button to start voice input.
  - Extension captures audio, processes it with Sherpa-onnx, and converts it to text.
  - Transcribed text is inserted into the editor or displayed.

- **TTS (Text-to-Speech):**

  - Users input text or select text in the editor.
  - Extension processes the text with Sherpa-onnx and generates audio.
  - Audio is played back to the user.

**User Interface:**

- **Webview Panel:**

  - Contains buttons for STT and TTS.
  - May include additional controls or settings.

- **Commands:**

  - Accessible via the Command Palette.
  - Keybindings can be set for quick access.

**Extension Activation:**

- Activated when the user executes a specific command (e.g., `tts-stt-cursor.start`).

**Permissions and Security:**

- Requests microphone access through the webview.
- All processing is done locally.
- Uses CSP in the webview for enhanced security.

**Performance:**

- Efficient processing using Sherpa-onnx Node.js integration.
- Asynchronous operations prevent blocking the main thread.

**Compatibility:**

- Works on Windows, macOS, and Linux.
- Tested in both VS Code and Cursor.

---

## Additional Tips

- **Error Handling:**

  - Implement robust error handling.
  - Provide user-friendly error messages.

- **Logging:**

  - Use console logs for debugging during development.
  - Minimize logging in the production version.

- **User Settings:**

  - Allow users to configure settings (e.g., voice parameters, language models).

- **Updates and Maintenance:**

  - Keep the extension updated with the latest dependencies.
  - Monitor user feedback for improvements.

---

## Conclusion

By following this implementation plan, you will establish a solid foundation for developing a VS Code extension that integrates Sherpa-onnx for STT and TTS functionalities within the Cursor IDE. Starting with a well-organized project structure and setting up the necessary files ensures a smooth development process.

**Key Reminders:**

- **Incremental Development:**

  - Start with basic functionality and gradually add features.

- **Frequent Testing:**

  - Regularly test the extension during development.

- **Documentation:**

  - Write comments and keep the README updated.

- **Community Engagement:**

  - If published, engage with users for feedback and improvements.

With careful planning and adherence to best practices, you can create an extension that significantly enhances the user experience and accessibility of the Cursor IDE.

---

*Note: All code snippets and configurations provided are illustrative and may require adjustments to work in your specific environment.*