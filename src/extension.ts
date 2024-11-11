import * as vscode from 'vscode';
import * as path from 'path';
import * as sherpa from 'sherpa-onnx-node';

// Define message types for type safety
interface STTMessage {
    command: 'startSTT';
    audioData: ArrayBuffer;
}

interface TTSMessage {
    command: 'startTTS';
    text: string;
}

interface ErrorMessage {
    command: 'error';
    text: string;
}

type WebviewMessage = STTMessage | TTSMessage | ErrorMessage;

let currentPanel: vscode.WebviewPanel | undefined = undefined;

interface SherpaState {
    isInitialized: boolean;
    sttConfig?: sherpa.STTConfig;
    ttsConfig?: sherpa.TTSConfig;
}

const sherpaState: SherpaState = {
    isInitialized: false
};

async function initializeSherpa(context: vscode.ExtensionContext) {
    if (sherpaState.isInitialized) {
        return;
    }

    try {
        await sherpa.init();

        // Configure STT
        sherpaState.sttConfig = {
            modelPath: path.join(context.extensionPath, 'models', 'stt'),
            deviceId: -1, // CPU
            sampleRate: 16000,
            channels: 1
        };

        // Configure TTS
        sherpaState.ttsConfig = {
            modelPath: path.join(context.extensionPath, 'models', 'tts'),
            deviceId: -1, // CPU
            speakerId: 0,
            speed: 1.0
        };

        sherpaState.isInitialized = true;
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize Sherpa-onnx';
        throw new Error(`Sherpa initialization failed: ${errorMessage}`);
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "TTS-STT for Cursor" is now active.');

    let sttCommand = vscode.commands.registerCommand('tts-stt-cursor.startSTT', () => {
        createWebviewPanel(context, 'STT');
    });

    let ttsCommand = vscode.commands.registerCommand('tts-stt-cursor.startTTS', () => {
        createWebviewPanel(context, 'TTS');
    });

    context.subscriptions.push(sttCommand, ttsCommand);
}

function createWebviewPanel(context: vscode.ExtensionContext, mode: 'STT' | 'TTS') {
    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.One);
        return;
    }

    currentPanel = vscode.window.createWebviewPanel(
        'ttsSttCursor',
        `${mode} for Cursor`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(context.extensionPath, 'media')),
                vscode.Uri.file(path.join(context.extensionPath, 'out')),
                vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview'))
            ]
        }
    );

    currentPanel.onDidDispose(
        () => {
            currentPanel = undefined;
        },
        null,
        context.subscriptions
    );

    currentPanel.webview.html = getWebviewContent(context, currentPanel.webview);

    // Initialize Sherpa-onnx
    initializeSherpa(context).catch(error => {
        vscode.window.showErrorMessage(error.message);
    });

    currentPanel.webview.onDidReceiveMessage(
        async (message: WebviewMessage) => {
            try {
                switch (message.command) {
                    case 'startSTT':
                        const transcription = await handleSTT(message.audioData);
                        currentPanel?.webview.postMessage({ command: 'transcriptionResult', text: transcription });
                        break;
                    case 'startTTS':
                        const audioData = await handleTTS(message.text);
                        currentPanel?.webview.postMessage({ command: 'playAudio', audioData });
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(message.text);
                        break;
                }
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
                vscode.window.showErrorMessage(`Error: ${errorMessage}`);
            }
        },
        undefined,
        context.subscriptions
    );
}

function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
    // Generate a nonce to whitelist specific inline scripts
    const nonce = getNonce();

    // Get paths to webview files
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'script.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'style.css'));

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; 
            script-src 'nonce-${nonce}' ${webview.cspSource}; 
            style-src ${webview.cspSource} 'unsafe-inline';">
        <link href="${styleUri}" rel="stylesheet">
        <title>TTS-STT for Cursor</title>
    </head>
    <body>
        <button id="start-stt">🎤 Start STT</button>
        <button id="start-tts">🔊 Start TTS</button>
        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
}

async function handleSTT(audioData: ArrayBuffer): Promise<string> {
    if (!sherpaState.isInitialized || !sherpaState.sttConfig) {
        throw new Error('Sherpa-onnx not initialized');
    }

    try {
        return await sherpa.transcribe(sherpaState.sttConfig, audioData);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during transcription';
        throw new Error(`STT processing failed: ${errorMessage}`);
    }
}

async function handleTTS(text: string): Promise<ArrayBuffer> {
    if (!sherpaState.isInitialized || !sherpaState.ttsConfig) {
        throw new Error('Sherpa-onnx not initialized');
    }

    try {
        return await sherpa.synthesize(sherpaState.ttsConfig, text);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during synthesis';
        throw new Error(`TTS processing failed: ${errorMessage}`);
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function deactivate() {} 