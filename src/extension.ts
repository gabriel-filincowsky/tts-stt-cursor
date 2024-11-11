import * as vscode from 'vscode';
import * as path from 'path';
import * as sherpa from 'sherpa-onnx-node';
import { inspect } from 'util';

// Define and initialize the output channel
const outputChannel = vscode.window.createOutputChannel('TTS-STT Logs');

// Initialize APPENDLINE early to capture logs from ModelManager initialization
outputChannel.show(true); // Automatically show the output channel

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
    outputChannel.appendLine('Extension "TTS-STT for Cursor" is now active.');

    // Initialize ModelManager with logger
    const modelManager = new ModelManager(context, outputChannel.appendLine.bind(outputChannel));

    // Initialize Sherpa first
    try {
        await initializeSherpa(context, modelManager);
    } catch (error) {
        outputChannel.appendLine(`Failed to initialize Sherpa: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Continue with command registration even if Sherpa fails
    }

    // Register commands
    const commands = [
        vscode.commands.registerCommand('tts-stt-cursor.startSTT', () => {
            createWebviewPanel(context, 'STT', modelManager);
        }),
        vscode.commands.registerCommand('tts-stt-cursor.startTTS', () => {
            createWebviewPanel(context, 'TTS', modelManager);
        }),
        vscode.commands.registerCommand('tts-stt-cursor.testTTS', async () => {
            try {
                await testTTSConfig(context);
                vscode.window.showInformationMessage('TTS test completed successfully');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`TTS test failed: ${message}`);
            }
        })
    ];

    context.subscriptions.push(...commands);
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
        outputChannel.appendLine(`Starting TTS for text: ${text}`);
        const result = sherpaState.synthesizer.generate(text);
        outputChannel.appendLine(`TTS generation complete, sample rate: ${result.sampleRate}`);
        
        // Convert Float32Array to ArrayBuffer for web audio
        const buffer = new ArrayBuffer(result.samples.length * 4);
        const view = new Float32Array(buffer);
        view.set(result.samples);
        
        outputChannel.appendLine(`Audio buffer created, length: ${buffer.byteLength}`);
        return buffer;
    } catch (error: unknown) {
        outputChannel.appendLine(`TTS error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    outputChannel.appendLine(`\n=== Validating ${type} Configuration ===`);
    
    // Log all configuration properties
    outputChannel.appendLine('Configuration properties:');
    for (const [key, value] of Object.entries(config)) {
        outputChannel.appendLine(`  ${key}: ${typeof value === 'string' ? value : inspect(value, { depth: 2 })}`);
    }

    // Verify file existence for paths
    outputChannel.appendLine('\nVerifying file paths:');
    const pathProperties = type === 'STT' 
        ? ['encoder_param', 'decoder_param', 'joiner_param', 'tokens']
        : ['model', 'modelConfig', 'tokens'];

    for (const prop of pathProperties) {
        if (prop in config) {
            const exists = fsSync.existsSync(config[prop]);
            outputChannel.appendLine(`  ${prop}: ${exists ? 'EXISTS' : 'MISSING'} (${config[prop]})`);
            if (!exists) {
                outputChannel.appendLine(`    ⚠️ WARNING: Required file ${prop} not found!`);
            }
        } else {
            outputChannel.appendLine(`  ${prop}: MISSING FROM CONFIG`);
            outputChannel.appendLine(`    ❌ ERROR: Required property ${prop} not defined in config!`);
        }
    }

    // Type-specific validation
    if (type === 'STT') {
        outputChannel.appendLine('\nValidating STT-specific properties:');
        outputChannel.appendLine(`  sample_rate: ${config.featConfig.sampleRate} (should be 16000)`);
        outputChannel.appendLine(`  feature_dim: ${config.featConfig.featureDim} (should be 80)`);
        outputChannel.appendLine(`  enable_endpoint_detection: ${config.enableEndpoint}`);
    } else {
        outputChannel.appendLine('\nValidating TTS-specific properties:');
        // Enhanced TTS-specific validations
        try {
            outputChannel.appendLine(`  model: ${config.model}`);
            const modelExists = fsSync.existsSync(config.model);
            outputChannel.appendLine(`    Status: ${modelExists ? '✅ Found' : '❌ Missing'}`);

            outputChannel.appendLine(`  modelConfig: ${config.modelConfig}`);
            const configExists = fsSync.existsSync(config.modelConfig);
            outputChannel.appendLine(`    Status: ${configExists ? '✅ Found' : '❌ Missing'}`);
            
            if (configExists) {
                const configContent = fsSync.readFileSync(config.modelConfig, 'utf8');
                outputChannel.appendLine(`    Content: ${inspect(JSON.parse(configContent), { depth: 2 })}`);
            }

            outputChannel.appendLine(`  tokens: ${config.tokens}`);
            const tokensExist = fsSync.existsSync(config.tokens);
            outputChannel.appendLine(`    Status: ${tokensExist ? '✅ Found' : '❌ Missing'}`);

            outputChannel.appendLine(`  numThreads: ${config.numThreads}`);
            if (config.numThreads < 1) {
                outputChannel.appendLine(`    ⚠️ WARNING: numThreads should be greater than 0`);
            } else {
                outputChannel.appendLine(`    ✅ Valid thread count`);
            }

            outputChannel.appendLine(`  debug: ${config.debug}`);
        } catch (error) {
            outputChannel.appendLine(`  ❌ Error during TTS validation: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

async function initializeSherpa(
    context: vscode.ExtensionContext,
    modelManager: ModelManager
) {
    if (sherpaState.isInitialized) {
        return;
    }

    try {
        outputChannel.appendLine('\n=== Starting Sherpa Initialization ===');
        
        // Log available Sherpa exports without circular references
        outputChannel.appendLine(`Available Sherpa exports: ${JSON.stringify(Object.keys(sherpa))}`);
        outputChannel.appendLine(`OnlineRecognizer type: ${typeof sherpa.OnlineRecognizer}`);
        outputChannel.appendLine(`OfflineTts type: ${typeof sherpa.OfflineTts}`);

        // Initialize models
        outputChannel.appendLine('\nInitializing models...');
        const initialized = await modelManager.initialize();
        if (!initialized) {
            throw new Error('Failed to initialize models');
        }
        outputChannel.appendLine('Models initialized successfully.');

        // Get current models
        outputChannel.appendLine('\nRetrieving current models...');
        const sttModel = await modelManager.getCurrentModel('stt');
        const ttsModel = await modelManager.getCurrentModel('tts');

        if (!sttModel || !ttsModel) {
            throw new Error('Required models not found. Please check the models directory.');
        }
        outputChannel.appendLine('STT and TTS models retrieved successfully.');

        // Verify model files
        outputChannel.appendLine('\nVerifying STT model files...');
        const sttVerified = await modelManager.verifyModelFiles(sttModel);
        if (!sttVerified) {
            throw new Error('STT model files verification failed');
        }
        outputChannel.appendLine('STT model files verified successfully.');

        outputChannel.appendLine('\nVerifying TTS model files...');
        const ttsVerified = await modelManager.verifyModelFiles(ttsModel);
        if (!ttsVerified) {
            throw new Error('TTS model files verification failed');
        }
        outputChannel.appendLine('TTS model files verified successfully.');

        // Get model paths
        outputChannel.appendLine('\nRetrieving model paths...');
        const sttPaths = await getModelPaths(sttModel, 'stt');
        const ttsPaths = await getModelPaths(ttsModel, 'tts');
        outputChannel.appendLine('Model paths retrieved successfully.');

        // Define model directories
        const sttModelDir = sttModel.extractedPath;
        const ttsModelDir = ttsModel.extractedPath;

        // Initialize STT with correct config structure
        outputChannel.appendLine('\nConfiguring STT...');
        const sttConfig: sherpa.OnlineRecognizerConfig = {
            transducer: {
                encoder: path.join(sttModelDir, 'encoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx'),
                decoder: path.join(sttModelDir, 'decoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx'),
                joiner: path.join(sttModelDir, 'joiner-epoch-99-avg-1-chunk-16-left-128.int8.onnx'),
            },
            tokens: path.join(sttModelDir, 'tokens.txt'),
            featConfig: {
                sampleRate: 16000,
                featureDim: 80
            },
            decodingConfig: {
                method: "greedy_search"
            },
            enableEndpoint: true,
            modelConfig: path.join(path.dirname(sttModelDir), 'model_config.json'),
            rule1MinTrailingSilence: 1.0,
            decoderConfig: {},
            hotwordsFile: '',
            hotwordsScore: 1.0
        };

        // Initialize TTS with correct config
        outputChannel.appendLine('Configuring TTS...');
        const ttsConfig: sherpa.OfflineTtsConfig = {
            model: ttsPaths.model,
            modelConfig: path.join(path.dirname(ttsModelDir), 'model_config.json'),
            tokens: ttsPaths.tokens,
            numThreads: 1,
            debug: true,
            noiseScale: 0.667,  // from inference.noise_scale
            lengthScale: 1.0,   // from inference.length_scale
            noiseW: 0.8        // from inference.noise_w
        };

        outputChannel.appendLine('\n=== Configuration ===');
        outputChannel.appendLine(`STT Config: ${inspect(sttConfig, { depth: null })}`);
        outputChannel.appendLine(`TTS Config: ${inspect(ttsConfig, { depth: null })}`);

        // Create instances
        outputChannel.appendLine('\n=== Creating Instances ===');

        outputChannel.appendLine('Creating OnlineRecognizer...');
        sherpaState.recognizer = new sherpa.OnlineRecognizer(sttConfig);
        outputChannel.appendLine('OnlineRecognizer created successfully.');

        outputChannel.appendLine('Creating OfflineTts...');
        sherpaState.synthesizer = new sherpa.OfflineTts(ttsConfig);
        outputChannel.appendLine('OfflineTts created successfully.');

        sherpaState.isInitialized = true;
        vscode.window.showInformationMessage('Speech processing initialized successfully');
        outputChannel.appendLine('Sherpa initialization completed successfully.');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize Sherpa-onnx';
        outputChannel.appendLine(`Sherpa initialization error: ${errorMessage}`);
        vscode.window.showErrorMessage(`Sherpa initialization failed: ${errorMessage}`);
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
            outputChannel.appendLine(`Microphone access error: ${error.message}`);
            vscode.window.showErrorMessage(`Microphone access error: ${error.message}`);
        } else {
            outputChannel.appendLine('Failed to access microphone');
            vscode.window.showErrorMessage('Failed to access microphone');
        }
        return undefined;
    }
}

export function deactivate() {
    outputChannel.dispose();
}

// Add near the end of the file, before deactivate()
async function testTTSConfig(context: vscode.ExtensionContext): Promise<void> {
    outputChannel.appendLine('\n=== Testing TTS Configuration ===');
    try {
        const modelManager = new ModelManager(context, outputChannel.appendLine.bind(outputChannel));
        await modelManager.initialize();
        
        const ttsModel = await modelManager.getCurrentModel('tts');
        if (!ttsModel) {
            throw new Error('TTS model not found');
        }

        const ttsPaths = await getModelPaths(ttsModel, 'tts');
        const ttsConfig: sherpa.OfflineTtsConfig = {
            model: ttsPaths.model,
            modelConfig: ttsPaths.modelConfig,
            tokens: ttsPaths.tokens,
            numThreads: 1,
            debug: true,
            noiseScale: 0.667,  // from inference.noise_scale
            lengthScale: 1.0,   // from inference.length_scale
            noiseW: 0.8        // from inference.noise_w
        };

        // Validate configuration
        validateConfig(ttsConfig, 'TTS');

        // Test TTS generation
        const synthesizer = new sherpa.OfflineTts(ttsConfig);
        const testText = "This is a test of the text-to-speech system.";
        const result = synthesizer.generate(testText);
        
        outputChannel.appendLine(`\nTTS Test Results:`);
        outputChannel.appendLine(`  Input text: ${testText}`);
        outputChannel.appendLine(`  Output sample rate: ${result.sampleRate}`);
        outputChannel.appendLine(`  Output samples length: ${result.samples.length}`);
        outputChannel.appendLine(`  Test completed successfully ✅`);
    } catch (error) {
        outputChannel.appendLine(`\n❌ TTS Test Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
} 