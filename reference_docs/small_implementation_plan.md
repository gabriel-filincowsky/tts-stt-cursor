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
    - [x] Download the STT/ASR models.
    - [x] Set up audio input capture in the Webview.
    - [ ] Integrate Sherpa-onnx STT processing in the extension.
    - [ ] Handle transcription results and display them in the IDE.

6. **Implement TTS Functionality**
    - [x] Download the TTS models.
    - [x] Capture text input or selection from the user.
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

### 5. Implement STT Functionality

In the webview, set up audio input capture using the Web Audio API, handling user permissions and potential errors. Integrate Sherpa-onnx STT processing in the extension, converting audio data received from the webview into text. Handle the transcription results by displaying them to the user or inserting them into the editor.

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

Capture text input from the user or obtain selected text from the editor. Integrate Sherpa-onnx TTS processing to synthesize speech from the text input. Send the synthesized audio back to the webview for playback, ensuring smooth and synchronized audio output.

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

Implement proper permission requests for accessing the microphone, providing clear messages to the user about why permissions are needed. Set up a Content Security Policy for the webview to enhance security and prevent unauthorized content execution. Ensure that all data processing occurs locally, maintaining user privacy and data security.

### 8. Testing and Debugging

Test the extension's functionality across different operating systems, including Windows, macOS, and Linux, to ensure cross-platform compatibility. Use debugging tools to identify and resolve issues, optimizing performance and resource usage. Validate the user experience by ensuring the interface is responsive and provides appropriate feedback during operations.

### 9. Prepare for Distribution

Update documentation, including the README and CHANGELOG files, providing clear installation instructions, feature descriptions, and version history. Package the extension using VSCE, ensuring that all necessary files and assets are included. Test the packaged extension installation in VS Code or Cursor to verify that it installs correctly and functions as intended.

### 10. Publish and Maintain

Publish the extension to the marketplace if applicable, following submission guidelines and providing necessary metadata and assets. Set up a workflow for updates and maintenance, planning for regular updates, bug fixes, and feature enhancements. Engage with users by creating channels for feedback, such as an issue tracker or contact email, to continuously improve the extension based on user input.