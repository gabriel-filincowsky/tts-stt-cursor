import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as tar from 'tar';
import bz2 from 'unbzip2-stream';

type ExtractError = Error & {
    code?: string;
    path?: string;
};

export interface ModelInfo {
    name: string;
    type: 'stt' | 'tts';
    compressedPath: string;
    extractedPath: string;
}

export class ModelManager {
    private availableModels: ModelInfo[] = [];

    constructor(private context: vscode.ExtensionContext) {}

    async initialize(): Promise<boolean> {
        try {
            // Scan for available models
            await this.scanModels();
            
            // Extract all found models
            for (const model of this.availableModels) {
                const extractedPath = await this.extractModel(model.compressedPath);
                model.extractedPath = extractedPath; // Update the extractedPath after extraction
            }

            return true;
        } catch (error) {
            console.error('Model initialization error:', error);
            return false;
        }
    }

    private async scanModels(): Promise<void> {
        this.availableModels = [];

        // Scan STT models
        const sttDir = path.join(this.context.extensionPath, 'models', 'stt');
        const sttFiles = await fs.readdir(sttDir);
        for (const file of sttFiles) {
            if (file.endsWith('.tar.bz2')) {
                const baseName = path.parse(path.parse(file).name).name; // Remove both .tar and .bz2
                const compressedPath = path.join(sttDir, file);
                const extractedPath = path.join(sttDir, baseName);
                this.availableModels.push({
                    name: baseName,
                    type: 'stt',
                    compressedPath,
                    extractedPath
                });
            }
        }

        // Scan TTS models
        const ttsDir = path.join(this.context.extensionPath, 'models', 'tts');
        const ttsFiles = await fs.readdir(ttsDir);
        for (const file of ttsFiles) {
            if (file.endsWith('.tar.bz2')) {
                const baseName = path.parse(path.parse(file).name).name; // Remove both .tar and .bz2
                const compressedPath = path.join(ttsDir, file);
                const extractedPath = path.join(ttsDir, baseName);
                this.availableModels.push({
                    name: baseName,
                    type: 'tts',
                    compressedPath,
                    extractedPath
                });
            }
        }

        console.log('Found models:', this.availableModels);
    }

    private async extractModel(compressedPath: string): Promise<string> {
        const baseName = path.parse(path.parse(compressedPath).name).name;
        const extractDir = path.join(path.dirname(compressedPath), baseName);
        
        try {
            // Check if already extracted
            await fs.access(extractDir);
            console.log(`Model already extracted at: ${extractDir}`);
            
            // Verify the directory has contents
            const contents = await fs.readdir(extractDir);
            if (contents.length > 0) {
                return extractDir;
            }
            // If directory is empty, remove it and extract again
            await fs.rm(extractDir, { recursive: true });
        } catch {
            // Directory doesn't exist, that's fine
        }

        // Extract the model
        console.log(`Extracting model from: ${compressedPath}`);
        await fs.mkdir(extractDir, { recursive: true });

        return new Promise((resolve, reject) => {
            const readStream = fsSync.createReadStream(compressedPath);
            readStream
                .pipe(bz2())
                .pipe(tar.extract({ 
                    cwd: extractDir,
                    strip: 1  // Strip the first directory level
                }))
                .on('error', (error: ExtractError) => {
                    console.error(`Extraction failed:`, error);
                    reject(error);
                })
                .on('end', () => {
                    console.log(`Extraction complete to: ${extractDir}`);
                    resolve(extractDir);
                });
        });
    }

    async getCurrentModel(type: 'stt' | 'tts'): Promise<ModelInfo | undefined> {
        return this.availableModels.find(m => m.type === type);
    }

    async verifyModelFiles(modelInfo: ModelInfo): Promise<boolean> {
        try {
            console.log(`Verifying files in: ${modelInfo.extractedPath}`);
            const files = await fs.readdir(modelInfo.extractedPath);
            console.log(`Files in ${modelInfo.type.toUpperCase()} model directory:`, files);

            const requiredFiles = modelInfo.type === 'stt' 
                ? [
                    'encoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx',
                    'decoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx',
                    'joiner-epoch-99-avg-1-chunk-16-left-128.int8.onnx',
                    'tokens.txt'
                ]
                : [
                    'en_US-amy-low.onnx',
                    'en_US-amy-low.onnx.json',
                    'tokens.txt'
                ];

            const hasAllFiles = requiredFiles.every(file => files.includes(file));
            console.log(`Required files ${hasAllFiles ? 'found' : 'missing'} in ${modelInfo.extractedPath}`);
            return hasAllFiles;
        } catch (error) {
            console.error(`Error verifying model files:`, error);
            return false;
        }
    }
} 