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
    private logger: (message: string) => void;

    constructor(private context: vscode.ExtensionContext, logger: (message: string) => void) {
        this.logger = logger;
    }

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
            this.logger(`Model initialization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    }

    private async extractModel(compressedPath: string): Promise<string> {
        const baseName = path.parse(path.parse(compressedPath).name).name;
        const extractDir = path.join(path.dirname(compressedPath), baseName);

        // Validate compressed file exists
        if (!await this.validateModelPath(compressedPath)) {
            throw new Error(`Compressed model file not found: ${compressedPath}`);
        }

        try {
            // Check if already extracted
            await fs.access(extractDir);
            const contents = await fs.readdir(extractDir);
            if (contents.length > 0) {
                this.logger(`Model already extracted at: ${extractDir}`);
                return extractDir;
            }
        } catch {
            // Directory doesn't exist or is empty, proceed with extraction
            await fs.mkdir(extractDir, { recursive: true });
        }

        // Extract the model
        this.logger(`Extracting model from: ${compressedPath} to ${extractDir}`);

        return new Promise((resolve, reject) => {
            const readStream = fsSync.createReadStream(compressedPath);
            readStream
                .pipe(bz2())
                .pipe(tar.extract({ 
                    cwd: extractDir,
                    strip: 1  // Strip the first directory level
                }))
                .on('error', (error: ExtractError) => {
                    this.logger(`Extraction failed: ${error.message}`);
                    reject(error);
                })
                .on('end', () => {
                    this.logger(`Extraction complete to: ${extractDir}`);
                    resolve(extractDir);
                });
        });
    }

    async getCurrentModel(type: 'stt' | 'tts'): Promise<ModelInfo | undefined> {
        const model = this.availableModels.find(m => m.type === type);
        this.logger(`Retrieved current model for type '${type}': ${model ? model.name : 'None'}`);
        return model;
    }

    async verifyModelFiles(modelInfo: ModelInfo): Promise<boolean> {
        try {
            this.logger(`Verifying files in: ${modelInfo.extractedPath}`);
            const files = await fs.readdir(modelInfo.extractedPath);
            this.logger(`Found files: ${files.join(', ')}`);

            // Get the shared config path
            const configDir = path.dirname(modelInfo.extractedPath);
            const sharedConfigPath = path.join(configDir, 'model_config.json');

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

            // Check shared config exists
            try {
                await fs.access(sharedConfigPath);
                this.logger(`Found shared config at: ${sharedConfigPath}`);
            } catch {
                this.logger(`Missing shared config at: ${sharedConfigPath}`);
                return false;
            }

            const missingFiles = requiredFiles.filter(file => !files.includes(file));
            
            if (missingFiles.length > 0) {
                this.logger(`Missing required files: ${missingFiles.join(', ')}`);
                return false;
            }

            // Verify file contents are accessible
            for (const file of requiredFiles) {
                const filePath = path.join(modelInfo.extractedPath, file);
                try {
                    const stats = await fs.stat(filePath);
                    if (stats.size === 0) {
                        this.logger(`File is empty: ${file}`);
                        return false;
                    }
                } catch (error) {
                    this.logger(`Error accessing file ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    return false;
                }
            }

            this.logger(`All required files verified successfully in ${modelInfo.extractedPath}`);
            return true;
        } catch (error) {
            this.logger(`Error verifying model files: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }

    private async validateModelPath(path: string): Promise<boolean> {
        try {
            await fs.access(path);
            const stats = await fs.stat(path);
            return stats.isFile();
        } catch {
            return false;
        }
    }
} 