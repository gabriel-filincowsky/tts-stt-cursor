import * as vscode from 'vscode';
import * as path from 'path';
import type { OnlineRecognizer, OfflineTts, OnlineRecognizerConfig, OfflineTtsConfig } from 'sherpa-onnx-node';
const sherpa = require('sherpa-onnx-node');
import { inspect } from 'util';

// Import the output channel
import { outputChannel } from './utils/output-channel';

import { ModelManager } from './model-manager';
import { ModelInfo } from './types/model-info';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { getModelPaths } from './utils/model-paths';
import { STTConfig, TTSConfig } from './types/config';
import { VersionManager } from './utils/version-manager';
import { synchronizeVersions } from './utils/sync-versions';
import { GPUManager } from './utils/gpu-manager';
import { validateSTTConfig, validateTTSConfig } from './utils/config-validator';
import { migrateVersionState } from './utils/version-migration';

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
    recognizer?: OnlineRecognizer;
    synthesizer?: OfflineTts;
}

const sherpaState: SherpaState = {
    isInitialized: false
};

interface GPUInfo {
    isAvailable: boolean;
    deviceId: number;
}

function initializeSherpaPath() {
    const platform = process.platform;
    const arch = process.arch;
    const platform_arch = `${platform === 'win32' ? 'win' : platform}-${arch}`;
    
    // Add all possible paths for the addon
    const possible_paths = [
        path.join(__dirname, '../build/Release/sherpa-onnx.node'),
        path.join(__dirname, '../build/Debug/sherpa-onnx.node'),
        path.join(__dirname, `../node_modules/sherpa-onnx-${platform_arch}/sherpa-onnx.node`),
        path.join(__dirname, `../sherpa-onnx-${platform_arch}/sherpa-onnx.node`),
        path.join(__dirname, './sherpa-onnx.node'),
    ];

    // Log paths for debugging
    outputChannel.appendLine('Checking sherpa-onnx paths:');
    possible_paths.forEach(p => {
        const exists = fsSync.existsSync(p);
        outputChannel.appendLine(`${p}: ${exists ? 'EXISTS' : 'MISSING'}`);
    });
}

export async function activate(context: vscode.ExtensionContext) {
    try {
        outputChannel.appendLine('=== Extension Activation Started ===');
        outputChannel.show();
        
        // Version management initialization
        await migrateVersionState();
        const versionManager = VersionManager.getInstance();
        const targetVersion = await versionManager.determineTargetVersion();
        
        // Missing: Command Registration
        // This is where we need to register all commands
        context.subscriptions.push(
            vscode.commands.registerCommand('tts-stt-cursor.startSTT', () => {
                // Implementation
            }),
            vscode.commands.registerCommand('tts-stt-cursor.startTTS', () => {
                // Implementation
            }),
            // ... other commands
        );

        // Missing: WebView Panel Initialization
        // This is needed for UI interactions
        
        // Missing: Model Initialization
        // Required before any STT/TTS operations
        
    } catch (error) {
        outputChannel.appendLine(`Activation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
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
        async (message: WebviewMessage) => {
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

async function initializeSherpa(context: vscode.ExtensionContext): Promise<void> {
    try {
        outputChannel.appendLine('\n=== Starting Sherpa Initialization ===\n');
        
        await synchronizeVersions();
        outputChannel.appendLine('Version synchronization complete');
        
        const modelManager = new ModelManager(context, (msg) => outputChannel.appendLine(msg));
        await modelManager.initialize();
        
        // Get and validate STT configuration
        const sttModel = await modelManager.getCurrentModel('stt');
        if (!sttModel) {
            throw new Error('STT model not found');
        }
        const sttPaths = await getModelPaths(sttModel, 'stt');
        const sttConfig = await createSTTConfig(sttPaths);
        
        outputChannel.appendLine('\nValidating STT configuration...');
        const sttErrors = await validateSTTConfig(sttConfig);
        if (sttErrors.length > 0) {
            throw new Error(`STT configuration validation failed:\n${sttErrors.join('\n')}`);
        }
        
        // Get and validate TTS configuration
        const ttsModel = await modelManager.getCurrentModel('tts');
        if (!ttsModel) {
            throw new Error('TTS model not found');
        }
        const ttsPaths = await getModelPaths(ttsModel, 'tts');
        const ttsConfig = await createTTSConfig(ttsPaths);
        
        outputChannel.appendLine('\nValidating TTS configuration...');
        const ttsErrors = await validateTTSConfig(ttsConfig);
        if (ttsErrors.length > 0) {
            throw new Error(`TTS configuration validation failed:\n${ttsErrors.join('\n')}`);
        }

        // Initialize with validated configs
        outputChannel.appendLine('\nInitializing Sherpa instances...');
        
        try {
            outputChannel.appendLine('Creating OnlineRecognizer...');
            const recognizerConfig = convertToRecognizerConfig(sttConfig);
            outputChannel.appendLine('Converted STT config:');
            outputChannel.appendLine(inspect(recognizerConfig, { depth: null, colors: false }));
            sherpaState.recognizer = new sherpa.OnlineRecognizer(recognizerConfig);
            outputChannel.appendLine('✅ OnlineRecognizer created successfully');
        } catch (error) {
            outputChannel.appendLine(`❌ Failed to create OnlineRecognizer: ${error instanceof Error ? error.message : 'Unknown error'}`);
            if (error instanceof Error && error.stack) {
                outputChannel.appendLine(`Stack trace: ${error.stack}`);
            }
            throw error;
        }

        try {
            outputChannel.appendLine('\nCreating OfflineTts...');
            outputChannel.appendLine('TTS config:');
            outputChannel.appendLine(inspect(ttsConfig, { depth: null, colors: false }));
            sherpaState.synthesizer = new sherpa.OfflineTts(ttsConfig);
            outputChannel.appendLine('✅ OfflineTts created successfully');
        } catch (error) {
            outputChannel.appendLine(`❌ Failed to create OfflineTts: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }

        sherpaState.isInitialized = true;
        outputChannel.appendLine('\n✅ Sherpa initialization completed successfully');

    } catch (error) {
        outputChannel.appendLine(`\n❌ Sherpa initialization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
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
        
        // Read model config
        const modelConfigContent = await fs.readFile(ttsPaths.modelConfig, 'utf8');
        const modelConfig = JSON.parse(modelConfigContent);
        
        const ttsConfig: OfflineTtsConfig = {
            model: ttsPaths.model,
            modelConfig: ttsPaths.modelConfig,
            tokens: ttsPaths.tokens,
            numThreads: 1,
            debug: true,
            // Add these parameters from the model config
            noiseScale: modelConfig.inference.noise_scale,
            lengthScale: modelConfig.inference.length_scale,
            noiseW: modelConfig.inference.noise_w
        };

        // Log the complete config for debugging
        outputChannel.appendLine('\nTTS Config:');
        outputChannel.appendLine(JSON.stringify(ttsConfig, null, 2));

        // Add validation before initialization
        outputChannel.appendLine('\nValidating configuration before test:');
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

async function createSTTConfig(modelPaths: Record<string, string>): Promise<STTConfig> {
    const config: STTConfig = {
        transducer: {
            encoder: modelPaths.encoder,
            decoder: modelPaths.decoder,
            joiner: modelPaths.joiner
        },
        tokens: modelPaths.tokens,
        featConfig: {
            sampleRate: 16000,
            featureDim: 80
        },
        decodingConfig: {
            method: 'greedy_search',
            numActivePaths: 4,
            beamSize: 4,
            temperature: 1.0
        },
        enableEndpoint: true,
        rule1MinTrailingSilence: 145
    };
    
    // Log the full config for debugging
    outputChannel.appendLine('\nFull STT Config:');
    outputChannel.appendLine(JSON.stringify(config, null, 2));
    
    // Add detailed validation logging
    outputChannel.appendLine('\nValidating STT configuration:');
    outputChannel.appendLine(`Transducer files:`);
    outputChannel.appendLine(`  encoder: ${fsSync.existsSync(config.transducer.encoder) ? '✅' : '❌'} ${config.transducer.encoder}`);
    outputChannel.appendLine(`  decoder: ${fsSync.existsSync(config.transducer.decoder) ? '✅' : '❌'} ${config.transducer.decoder}`);
    outputChannel.appendLine(`  joiner: ${fsSync.existsSync(config.transducer.joiner) ? '✅' : '❌'} ${config.transducer.joiner}`);
    outputChannel.appendLine(`Tokens file: ${fsSync.existsSync(config.tokens) ? '✅' : '❌'} ${config.tokens}`);
    
    return config;
}

async function createTTSConfig(modelPaths: Record<string, string>): Promise<TTSConfig> {
    // Read the model config file to get the correct parameters
    const modelConfigContent = await fs.readFile(modelPaths.modelConfig, 'utf8');
    const modelConfig = JSON.parse(modelConfigContent);
    
    return {
        model: modelPaths.model,
        modelConfig: modelPaths.modelConfig,
        tokens: modelPaths.tokens,
        numThreads: 1,
        debug: true,
        // Use values from the model's config file
        noiseScale: modelConfig.inference.noise_scale,
        lengthScale: modelConfig.inference.length_scale,
        noiseW: modelConfig.inference.noise_w
    };
}

function convertToRecognizerConfig(config: STTConfig): OnlineRecognizerConfig {
    return {
        ...config,
        decodingConfig: {
            method: config.decodingConfig.method as "greedy_search" | "modified_beam_search"
        }
    };
}

async function testSTTConfig(context: vscode.ExtensionContext): Promise<void> {
    outputChannel.appendLine('\n=== Testing STT Configuration ===');
    try {
        const modelManager = new ModelManager(context, outputChannel.appendLine.bind(outputChannel));
        await modelManager.initialize();
        
        const sttModel = await modelManager.getCurrentModel('stt');
        if (!sttModel) {
            throw new Error('STT model not found');
        }

        const sttPaths = await getModelPaths(sttModel, 'stt');
        const sttConfig = await createSTTConfig(sttPaths);

        // Add validation before initialization
        outputChannel.appendLine('\nValidating configuration before test:');
        validateConfig(sttConfig, 'STT');

        // Test STT initialization
        const recognizer = new sherpa.OnlineRecognizer(convertToRecognizerConfig(sttConfig));
        
        outputChannel.appendLine(`\nSTT Test Results:`);
        outputChannel.appendLine(`  Initialization successful ✅`);
        recognizer.reset();  // Clean up
    } catch (error) {
        outputChannel.appendLine(`\n❌ STT Test Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
}

async function ensureNativeFiles() {
    const versionManager = VersionManager.getInstance();
    const platform = process.platform;
    const arch = process.arch;
    
    try {
        // First check version state
        const targetVersion = await versionManager.determineTargetVersion();
        if (await versionManager.validateVersionState(targetVersion)) {
            outputChannel.appendLine('Version validation successful');
        }

        // Then ensure binaries
        if (await versionManager.ensureBinariesInstalled(platform, arch)) {
            outputChannel.appendLine('Native files installation verified');
            return;
        }
        throw new Error('Binary installation failed');
    } catch (error) {
        outputChannel.appendLine(`Failed to ensure native files: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
}

async function downloadGPUFiles() {
    const gpuFilesUrl = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.10.16/sherpa-onnx-v1.10.16-linux-x64-gpu.tar.bz2';
    // Implementation of download and extract
    // This is just a placeholder - actual implementation would depend on your needs
}

async function checkNativeFiles(dir: string): Promise<boolean> {
    if (!fsSync.existsSync(dir)) {
        return false;
    }

    const platform = process.platform;
    const requiredFiles = platform === 'win32' 
        ? ['sherpa-onnx.dll', 'onnxruntime.dll']
        : ['libsherpa-onnx.so', 'libonnxruntime.so'];

    for (const file of requiredFiles) {
        const filePath = path.join(dir, file);
        if (!fsSync.existsSync(filePath)) {
            return false;
        }
    }

    return true;
} 