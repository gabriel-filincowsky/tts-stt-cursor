import * as vscode from 'vscode';
import * as path from 'path';
import * as sherpa from 'sherpa-onnx-node';
console.log('Sherpa module structure:', Object.keys(sherpa));
import { ModelManager, ModelInfo } from './model-manager';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';

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
    recognizer?: sherpa.OnlineRecognizer;
    synthesizer?: sherpa.OfflineTts;
}

const sherpaState: SherpaState = {
    isInitialized: false
};

interface GPUInfo {
    isAvailable: boolean;
    deviceId: number;
}

async function getModelPaths(modelInfo: ModelInfo, type: 'stt' | 'tts'): Promise<{[key: string]: string}> {
    const modelDir = modelInfo.extractedPath;
    
    if (type === 'stt') {
        return {
            encoder_param: path.join(modelDir, 'encoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx'),
            decoder_param: path.join(modelDir, 'decoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx'),
            joiner_param: path.join(modelDir, 'joiner-epoch-99-avg-1-chunk-16-left-128.int8.onnx'),
            tokens: path.join(modelDir, 'tokens.txt')
        };
    } else {
        return {
            model: path.join(modelDir, 'en_US-amy-low.onnx'),
            modelConfig: path.join(modelDir, 'en_US-amy-low.onnx.json'),
            tokens: path.join(modelDir, 'tokens.txt')
        };
    }
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('Extension "TTS-STT for Cursor" is now active.');

    // Initialize ModelManager
    const modelManager = new ModelManager(context);

    let sttCommand = vscode.commands.registerCommand('tts-stt-cursor.startSTT', () => {
        createWebviewPanel(context, 'STT', modelManager);
    });

    let ttsCommand = vscode.commands.registerCommand('tts-stt-cursor.startTTS', () => {
        createWebviewPanel(context, 'TTS', modelManager);
    });

    context.subscriptions.push(sttCommand, ttsCommand);
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
                    case 'requestMicrophoneAccess':
                        try {
                            const stream = await requestMicrophoneAccess();
                            if (stream) {
                                currentPanel?.webview.postMessage({ 
                                    command: 'microphoneAccessGranted',
                                    streamId: stream.id
                                });
                            } else {
                                currentPanel?.webview.postMessage({ 
                                    command: 'microphoneAccessDenied',
                                    reason: 'Failed to access microphone'
                                });
                            }
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                            currentPanel?.webview.postMessage({ 
                                command: 'microphoneAccessDenied',
                                reason: errorMessage
                            });
                        }
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

    // Get URIs for script and style
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'script.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'style.css'));

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; 
            media-device 'self';
            media-src 'self' mediastream:;
            script-src 'nonce-${nonce}' ${webview.cspSource}; 
            style-src ${webview.cspSource} 'unsafe-inline';">
        <title>TTS-STT for Cursor</title>
        <link href="${styleUri}" rel="stylesheet">
    </head>
    <body>
        <div class="container">
            <div id="status" class="status"></div>
            <div class="button-container">
                <button id="start-stt" class="button">
                    🎤 Start Recording
                </button>
                <button id="start-tts" class="button">
                    🔊 Start TTS
                </button>
            </div>
            <div id="permission-error" class="error-message" style="display: none;">
                ⚠️ Microphone access is required. Please allow access when prompted.
            </div>
        </div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
}

async function handleSTT(audioData: ArrayBuffer): Promise<string> {
    if (!sherpaState.isInitialized || !sherpaState.recognizer) {
        throw new Error('Speech recognition not initialized');
    }

    try {
        // Convert Buffer to Float32Array
        const buffer = Buffer.from(audioData);
        const float32Array = new Float32Array(buffer.length / 2);
        for (let i = 0; i < buffer.length; i += 2) {
            float32Array[i / 2] = buffer.readInt16LE(i) / 32768.0;
        }

        // Process audio
        sherpaState.recognizer.acceptWaveform(float32Array);
        sherpaState.recognizer.decode();
        const result = sherpaState.recognizer.getResult();
        sherpaState.recognizer.reset();

        // Get the active text editor
        const editor = vscode.window.activeTextEditor;
        
        if (editor) {
            await editor.edit(editBuilder => {
                if (editor.selection.isEmpty) {
                    editBuilder.insert(editor.selection.active, result);
                } else {
                    editBuilder.replace(editor.selection, result);
                }
            });
        } else {
            vscode.window.showInformationMessage(`Transcription: ${result}`);
        }

        return result;
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during transcription';
        throw new Error(`STT processing failed: ${errorMessage}`);
    }
}

async function handleTTS(text: string): Promise<ArrayBuffer> {
    if (!sherpaState.isInitialized || !sherpaState.synthesizer) {
        throw new Error('Speech synthesis not initialized');
    }

    try {
        console.log('Starting TTS for text:', text);
        const result = sherpaState.synthesizer.generate(text);
        console.log('TTS generation complete, sample rate:', result.sampleRate);
        
        // Convert Float32Array to ArrayBuffer for web audio
        const buffer = new ArrayBuffer(result.samples.length * 4);
        const view = new Float32Array(buffer);
        view.set(result.samples);
        
        console.log('Audio buffer created, length:', buffer.byteLength);
        return buffer;
    } catch (error: unknown) {
        console.error('TTS error:', error);
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

function validateConfig(config: any, type: 'STT' | 'TTS'): void {
    console.log(`\n=== Validating ${type} Configuration ===`);
    
    // Log all configuration properties
    console.log('Configuration properties:');
    for (const [key, value] of Object.entries(config)) {
        console.log(`  ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
    }

    // Verify file existence for paths
    console.log('\nVerifying file paths:');
    const pathProperties = type === 'STT' 
        ? ['encoder_param', 'decoder_param', 'joiner_param', 'tokens']
        : ['model', 'tokens'];

    for (const prop of pathProperties) {
        if (prop in config) {
            const exists = fsSync.existsSync(config[prop]);
            console.log(`  ${prop}: ${exists ? 'EXISTS' : 'MISSING'} (${config[prop]})`);
        } else {
            console.log(`  ${prop}: MISSING FROM CONFIG`);
        }
    }

    // Type-specific validation
    if (type === 'STT') {
        console.log('\nValidating STT-specific properties:');
        console.log(`  sample_rate: ${config.sample_rate} (should be 16000)`);
        console.log(`  feature_dim: ${config.feature_dim} (should be 80)`);
        console.log(`  enable_endpoint_detection: ${config.enable_endpoint_detection}`);
    } else {
        console.log('\nValidating TTS-specific properties:');
        console.log(`  noise_scale: ${config.noise_scale}`);
        console.log(`  length_scale: ${config.length_scale}`);
    }
}

async function verifyModelFiles(modelDir: string, type: 'STT' | 'TTS'): Promise<boolean> {
    try {
        console.log(`\nVerifying ${type} model files in: ${modelDir}`);
        
        // Check if directory exists
        const dirExists = fsSync.existsSync(modelDir);
        console.log(`Directory exists: ${dirExists}`);
        
        if (!dirExists) {
            return false;
        }

        // List all files recursively
        function listFiles(dir: string): string[] {
            const files = fsSync.readdirSync(dir);
            let result: string[] = [];
            
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fsSync.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    result = result.concat(listFiles(fullPath));
                } else {
                    result.push(fullPath);
                }
            }
            
            return result;
        }

        const files = listFiles(modelDir);
        console.log('Found files:', files);

        // Check specific required files
        if (type === 'STT') {
            const required = [
                'encoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx',
                'decoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx',
                'joiner-epoch-99-avg-1-chunk-16-left-128.int8.onnx',
                'tokens.txt'
            ];
            
            for (const file of required) {
                const exists = files.some(f => f.endsWith(file));
                console.log(`Required file ${file}: ${exists ? 'Found' : 'Missing'}`);
                if (!exists) return false;
            }
        } else {
            const required = [
                'en_US-amy-low.onnx',
                'tokens.txt'
            ];
            
            for (const file of required) {
                const exists = files.some(f => f.endsWith(file));
                console.log(`Required file ${file}: ${exists ? 'Found' : 'Missing'}`);
                if (!exists) return false;
            }
        }

        return true;
    } catch (error) {
        console.error(`Error verifying ${type} model files:`, error);
        return false;
    }
}

// Helper function to safely stringify configs
function safeStringify(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return '[Circular]';
            }
            seen.add(value);
        }
        return value;
    }, 2);
}

async function initializeSherpa(
    context: vscode.ExtensionContext,
    modelManager: ModelManager
) {
    if (sherpaState.isInitialized) {
        return;
    }

    try {
        console.log('\n=== Starting Sherpa Initialization ===');
        
        // Log available Sherpa exports without circular references
        console.log('Available Sherpa exports:', Object.keys(sherpa));
        console.log('OnlineRecognizer type:', typeof sherpa.OnlineRecognizer);
        console.log('OfflineTts type:', typeof sherpa.OfflineTts);

        // Initialize models
        const initialized = await modelManager.initialize();
        if (!initialized) {
            throw new Error('Failed to initialize models');
        }

        // Get current models
        const sttModel = await modelManager.getCurrentModel('stt');
        const ttsModel = await modelManager.getCurrentModel('tts');

        if (!sttModel || !ttsModel) {
            throw new Error('Required models not found. Please check the models directory.');
        }

        // Verify model files
        const sttVerified = await modelManager.verifyModelFiles(sttModel);
        const ttsVerified = await modelManager.verifyModelFiles(ttsModel);

        if (!sttVerified || !ttsVerified) {
            throw new Error('Model files verification failed');
        }

        // Get model paths
        const sttPaths = await getModelPaths(sttModel, 'stt');
        const ttsPaths = await getModelPaths(ttsModel, 'tts');

        // Initialize STT with correct config structure
        const sttConfig: sherpa.OnlineRecognizerConfig = {
            transducer: {
                encoder: sttPaths.encoder_param,
                decoder: sttPaths.decoder_param,
                joiner: sttPaths.joiner_param,
            },
            tokens: sttPaths.tokens,
            modelConfig: '',
            featConfig: {
                sampleRate: 16000,
                featureDim: 80
            },
            decodingConfig: {
                method: "greedy_search" as const
            },
            enableEndpoint: true,
            rule1MinTrailingSilence: 1.0,
            decoderConfig: {},
            hotwordsFile: '',
            hotwordsScore: 1.0
        };

        // Initialize TTS with correct config
        const ttsConfig = {
            model: ttsPaths.model,
            modelConfig: ttsPaths.modelConfig,  // Add the config file path
            tokens: ttsPaths.tokens,
            numThreads: 1,
            debug: true
        };

        console.log('\n=== Configuration ===');
        console.log('STT Config:', safeStringify(sttConfig));
        console.log('TTS Config:', safeStringify(ttsConfig));

        // Create instances
        console.log('\n=== Creating Instances ===');
        console.log('Creating OnlineRecognizer...');
        sherpaState.recognizer = new sherpa.OnlineRecognizer(sttConfig);
        console.log('OnlineRecognizer created successfully');

        console.log('Creating OfflineTts...');
        sherpaState.synthesizer = new sherpa.OfflineTts(ttsConfig);
        console.log('OfflineTts created successfully');

        sherpaState.isInitialized = true;
        vscode.window.showInformationMessage('Speech processing initialized successfully');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize Sherpa-onnx';
        console.error('Sherpa initialization error:', {
            message: errorMessage,
            stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        throw new Error(`Sherpa initialization failed: ${errorMessage}`);
    }
}

async function requestMicrophoneAccess(): Promise<MediaStream | undefined> {
    try {
        // Request permission through VS Code's API
        const result = await vscode.window.showInformationMessage(
            'This extension requires microphone access for speech recognition. Allow access?',
            'Allow',
            'Deny'
        );

        if (result !== 'Allow') {
            throw new Error('Microphone access denied by user');
        }

        // Use the standard Web Audio API
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        return stream;
    } catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`Microphone access error: ${error.message}`);
        } else {
            vscode.window.showErrorMessage('Failed to access microphone');
        }
        return undefined;
    }
}

export function deactivate() {} 