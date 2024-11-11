import * as vscode from 'vscode';
import * as path from 'path';
import * as sherpa from 'sherpa-onnx-node';
import { ModelManager } from './model-manager';

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

interface GPUInfo {
    isAvailable: boolean;
    deviceId: number;
}

async function checkGPUAvailability(): Promise<GPUInfo> {
    try {
        // Try to initialize with GPU (device 0)
        await sherpa.init({ deviceId: 0 });
        return { isAvailable: true, deviceId: 0 };
    } catch (error) {
        try {
            // If first GPU failed, try device 1 (some systems have multiple GPUs)
            await sherpa.init({ deviceId: 1 });
            return { isAvailable: true, deviceId: 1 };
        } catch (error) {
            // If both GPU attempts failed, fall back to CPU
            await sherpa.init({ deviceId: -1 });
            return { isAvailable: false, deviceId: -1 };
        }
    }
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('Extension "TTS-STT for Cursor" is now active.');

    // Initialize ModelManager
    const modelManager = new ModelManager(context);
    const initialized = await modelManager.initialize();
    
    if (!initialized) {
        throw new Error('Failed to initialize models');
    }

    let sttCommand = vscode.commands.registerCommand('tts-stt-cursor.startSTT', () => {
        createWebviewPanel(context, 'STT', modelManager);
    });

    let ttsCommand = vscode.commands.registerCommand('tts-stt-cursor.startTTS', () => {
        createWebviewPanel(context, 'TTS', modelManager);
    });

    let selectVoiceCommand = vscode.commands.registerCommand('tts-stt-cursor.selectVoice', async () => {
        await modelManager.selectTTSModel();
    });

    context.subscriptions.push(sttCommand, ttsCommand, selectVoiceCommand);
}

function createWebviewPanel(
    context: vscode.ExtensionContext, 
    mode: 'STT' | 'TTS',
    modelManager: ModelManager
) {
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
                vscode.Uri.joinPath(context.extensionUri, 'src', 'webview'),
                vscode.Uri.joinPath(context.extensionUri, 'media')
            ]
        }
    );

    // Handle panel disposal
    currentPanel.onDidDispose(
        () => {
            currentPanel = undefined;
        },
        null,
        context.subscriptions
    );

    // Set up the webview content
    currentPanel.webview.html = getWebviewContent(context, currentPanel.webview);

    // Handle messages from the webview
    currentPanel.webview.onDidReceiveMessage(
        async (message: any) => {
            try {
                if (!currentPanel) {
                    throw new Error('Webview panel is not available');
                }

                switch (message.command) {
                    case 'startSTT':
                        const transcription = await handleSTT(message.audioData);
                        currentPanel.webview.postMessage({ 
                            command: 'transcriptionResult', 
                            text: transcription 
                        });
                        break;
                        
                    case 'startTTS':
                        const audioData = await handleTTS(message.text);
                        currentPanel.webview.postMessage({ 
                            command: 'playAudio', 
                            audioData: audioData 
                        });
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

    // Initialize Sherpa-onnx
    initializeSherpa(context, modelManager).catch(error => {
        vscode.window.showErrorMessage(error.message);
    });
}

function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
    const nonce = getNonce();

    // Get local paths for scripts and styles
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'script.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'style.css'));

    // Set up CSP
    const csp = [
        `default-src 'none'`,
        `script-src 'nonce-${nonce}' 'unsafe-eval'`, // unsafe-eval needed for AudioContext
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `img-src ${webview.cspSource} https:`,
        `media-src mediastream:`, // Allow microphone access
        `connect-src 'none'` // Prevent any external connections
    ].join('; ');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="${csp}">
        <title>TTS-STT for Cursor</title>
        <link href="${styleUri}" rel="stylesheet">
    </head>
    <body>
        <div class="container">
            <div class="privacy-notice">
                🔒 All processing is done locally. No data leaves your computer.
            </div>
            <div class="button-container">
                <button id="start-stt" title="Requires microphone permission">
                    🎤 Start Recording
                </button>
                <button id="start-tts">
                    🔊 Start TTS
                </button>
            </div>
            <div id="status" class="status"></div>
            <div id="permission-error" class="error-message" style="display: none;">
                ⚠️ Microphone access is required for speech recognition.
                Please allow microphone access in your browser settings.
            </div>
        </div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
}

async function handleSTT(audioData: ArrayBuffer): Promise<string> {
    if (!sherpaState.isInitialized || !sherpaState.sttConfig) {
        throw new Error('Sherpa-onnx not initialized');
    }

    try {
        // Convert ArrayBuffer to Buffer for Sherpa-onnx
        const audioBuffer = Buffer.from(audioData);
        
        // Process audio with Sherpa-onnx
        const transcription = await sherpa.transcribe(sherpaState.sttConfig, audioBuffer);
        
        // Get the active text editor
        const editor = vscode.window.activeTextEditor;
        
        if (editor) {
            // Insert the transcription at the current cursor position
            editor.edit(editBuilder => {
                if (editor.selection.isEmpty) {
                    editBuilder.insert(editor.selection.active, transcription);
                } else {
                    editBuilder.replace(editor.selection, transcription);
                }
            });
        } else {
            // If no editor is active, show the transcription in a message
            vscode.window.showInformationMessage(`Transcription: ${transcription}`);
        }

        return transcription;
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
        // Process text with Sherpa-onnx TTS
        const audioBuffer = await sherpa.synthesize(sherpaState.ttsConfig, text);
        return audioBuffer;
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

async function initializeSherpa(
    context: vscode.ExtensionContext,
    modelManager: ModelManager
) {
    if (sherpaState.isInitialized) {
        return;
    }

    try {
        await sherpa.init();

        // Get current models
        const sttModel = await modelManager.getCurrentSTTModel();
        const ttsModel = await modelManager.getCurrentTTSModel();

        if (!sttModel || !ttsModel) {
            throw new Error('Required models not found');
        }

        // Configure STT
        sherpaState.sttConfig = {
            modelPath: path.dirname(sttModel.path),
            deviceId: -1, // CPU
            sampleRate: 16000,
            channels: 1
        };

        // Configure TTS
        sherpaState.ttsConfig = {
            modelPath: path.dirname(ttsModel.path),
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

export function deactivate() {} 