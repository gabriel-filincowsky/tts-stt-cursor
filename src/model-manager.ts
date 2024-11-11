import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as https from 'https';

interface ModelInfo {
    name: string;
    url?: string;  // Optional now since models might be manually downloaded
    type: 'stt' | 'tts';
    size: number;
    quality?: 'low' | 'medium' | 'high';
    voice?: string;
    path: string;  // Full path to the model
}

// Base URL for downloading models if needed
const BASE_TTS_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/';
const BASE_STT_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/';

const DEFAULT_MODELS = {
    tts: {
        name: 'vits-piper-en_US-amy-low',
        url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-amy-low.tar.bz2',
        size: 67112080
    },
    stt: {
        name: 'sherpa-onnx-streaming-zipformer-en-2023-06-26',
        url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-en-2023-06-26.tar.bz2',
        size: 201336340 // Update this with actual size
    }
};

export class ModelManager {
    private selectedTTSModel: string = 'vits-piper-en_US-amy-low'; // Default model
    private availableModels: ModelInfo[] = [];

    constructor(private context: vscode.ExtensionContext) {}

    async initialize(): Promise<boolean> {
        await this.detectAvailableModels();
        
        // Ensure default models exist
        const defaultModelsExist = await this.ensureDefaultModels();
        if (!defaultModelsExist) {
            return false;
        }

        // Load previously selected model from globalState
        const savedModel = this.context.globalState.get<string>('selectedTTSModel');
        if (savedModel && this.availableModels.some(m => m.name === savedModel)) {
            this.selectedTTSModel = savedModel;
        }

        return true;
    }

    private async ensureDefaultModels(): Promise<boolean> {
        try {
            // Ensure default TTS model
            const ttsPath = path.join(
                this.context.extensionPath, 
                'models', 
                'tts', 
                'vits-piper-en', 
                `${DEFAULT_MODELS.tts.name}.tar.bz2`
            );
            
            if (!await this.pathExists(ttsPath)) {
                await this.downloadModel({
                    name: DEFAULT_MODELS.tts.name,
                    type: 'tts',
                    size: DEFAULT_MODELS.tts.size,
                    url: DEFAULT_MODELS.tts.url,
                    path: ttsPath,
                    quality: 'low',
                    voice: 'Amy'
                });
            }

            // Ensure default STT model
            const sttPath = path.join(
                this.context.extensionPath, 
                'models', 
                'stt', 
                `${DEFAULT_MODELS.stt.name}.tar.bz2`
            );

            if (!await this.pathExists(sttPath)) {
                await this.downloadModel({
                    name: DEFAULT_MODELS.stt.name,
                    type: 'stt',
                    size: DEFAULT_MODELS.stt.size,
                    url: DEFAULT_MODELS.stt.url,
                    path: sttPath
                });
            }

            return true;
        } catch (error) {
            console.error('Error ensuring default models:', error);
            vscode.window.showErrorMessage('Failed to download default models');
            return false;
        }
    }

    private async detectAvailableModels(): Promise<void> {
        const modelsPath = path.join(this.context.extensionPath, 'models');
        
        try {
            // Detect TTS models
            const ttsPath = path.join(modelsPath, 'tts', 'vits-piper-en');
            const ttsFiles = await fs.readdir(ttsPath);
            
            for (const file of ttsFiles) {
                if (file.endsWith('.tar.bz2')) {
                    const filePath = path.join(ttsPath, file);
                    const stats = await fs.stat(filePath);
                    
                    // Parse model info from filename
                    const nameMatch = file.match(/vits-piper-en_US-(.+)-(low|medium|high)/);
                    if (nameMatch) {
                        const [, voice, quality] = nameMatch;
                        
                        this.availableModels.push({
                            name: path.parse(file).name,
                            type: 'tts',
                            size: stats.size,
                            quality: quality as 'low' | 'medium' | 'high',
                            voice: voice.replace(/_/g, ' '),
                            path: filePath,
                            url: `${BASE_TTS_URL}${file}`
                        });
                    }
                }
            }

            // Detect STT models
            const sttPath = path.join(modelsPath, 'stt');
            if (await this.pathExists(sttPath)) {
                const sttFiles = await fs.readdir(sttPath);
                
                for (const file of sttFiles) {
                    if (file.endsWith('.tar.bz2')) {
                        const filePath = path.join(sttPath, file);
                        const stats = await fs.stat(filePath);
                        
                        this.availableModels.push({
                            name: path.parse(file).name,
                            type: 'stt',
                            size: stats.size,
                            path: filePath,
                            url: `${BASE_STT_URL}${file}`
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error detecting models:', error);
            vscode.window.showErrorMessage('Error detecting available models');
        }
    }

    private async pathExists(path: string): Promise<boolean> {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

    async selectTTSModel(): Promise<void> {
        const ttsModels = this.availableModels.filter(model => model.type === 'tts');
        
        const models = ttsModels.map(model => ({
            label: `${model.voice} (${model.quality})`,
            description: `${(model.size / 1024 / 1024).toFixed(1)} MB`,
            detail: model.name,
            model: model.name
        }));

        const selected = await vscode.window.showQuickPick(models, {
            placeHolder: 'Select TTS Voice Model',
            title: 'Available Voice Models'
        });

        if (selected) {
            this.selectedTTSModel = selected.model;
            await this.context.globalState.update('selectedTTSModel', selected.model);
        }
    }

    async getCurrentTTSModel(): Promise<ModelInfo | undefined> {
        return this.availableModels.find(m => m.name === this.selectedTTSModel);
    }

    async getCurrentSTTModel(): Promise<ModelInfo | undefined> {
        return this.availableModels.find(m => m.type === 'stt');
    }

    async downloadModelIfNeeded(modelName: string): Promise<boolean> {
        const model = this.availableModels.find(m => m.name === modelName);
        if (!model || !model.url) {
            return false;
        }

        try {
            if (await this.pathExists(model.path)) {
                return true;
            }

            await this.downloadModel(model);
            return true;
        } catch (error) {
            console.error('Error downloading model:', error);
            return false;
        }
    }

    private async downloadModel(model: ModelInfo): Promise<void> {
        if (!model.url) {
            throw new Error('No URL provided for model download');
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Downloading ${model.name}`,
            cancellable: false
        }, async (progress) => {
            await fs.mkdir(path.dirname(model.path), { recursive: true });
            
            return new Promise<void>((resolve, reject) => {
                https.get(model.url!, response => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`Failed to download: ${response.statusCode}`));
                        return;
                    }

                    const file = fsSync.createWriteStream(model.path);
                    let downloaded = 0;

                    response.on('data', chunk => {
                        downloaded += chunk.length;
                        const percent = (downloaded / model.size) * 100;
                        progress.report({ increment: percent });
                    });

                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                }).on('error', reject);
            });
        });
    }
} 