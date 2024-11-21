import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as tar from 'tar';
import bz2 from 'unbzip2-stream';
import { ModelInfo } from './types/model-info';
import { VersionManager } from './utils/version-manager';
import { outputChannel } from './utils/output-channel';
import { meetsMinimumVersion } from './utils/version-utils';
import fetch from 'node-fetch';

type ExtractError = Error & {
    code?: string;
    path?: string;
};

export class ModelManager {
    private availableModels: ModelInfo[] = [];
    private logger: (message: string) => void;

    constructor(private context: vscode.ExtensionContext, logger: (message: string) => void) {
        this.logger = logger;
    }

    async initialize(): Promise<void> {
        try {
            const versionManager = VersionManager.getInstance();
            const targetVersion = await versionManager.determineTargetVersion();
            
            if (!await versionManager.validateVersionState(targetVersion)) {
                throw new Error('Version validation required before model initialization');
            }
            
            await this.ensureModelsDownloaded();
            await this.validateModels();
        } catch (error) {
            this.logger(`Model initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
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

    private async validateModelVersions(targetVersion: string): Promise<void> {
        try {
            outputChannel.appendLine(`Validating model versions against target version: ${targetVersion}`);
            
            for (const model of this.availableModels) {
                // Extract version from model metadata file
                const modelVersion = await this.extractModelVersion(model);
                if (!modelVersion) {
                    this.logger(`Could not determine version for model: ${model.name}`);
                    continue; // Skip this model but continue with others
                }
                
                this.logger(`Checking model ${model.name} version ${modelVersion} against target ${targetVersion}`);
                
                if (!meetsMinimumVersion(modelVersion, targetVersion)) {
                    this.logger(`Model ${model.name} version ${modelVersion} is not compatible with target version ${targetVersion}`);
                    // Mark model as incompatible but don't throw
                    model.status = 'incompatible';
                    continue;
                }
                
                this.logger(`Model ${model.name} version ${modelVersion} is compatible`);
                model.status = 'compatible';
            }

            // Check if we have at least one compatible model of each type
            const hasCompatibleSTT = this.availableModels.some(m => 
                m.type === 'stt' && m.status === 'compatible'
            );
            const hasCompatibleTTS = this.availableModels.some(m => 
                m.type === 'tts' && m.status === 'compatible'
            );

            if (!hasCompatibleSTT || !hasCompatibleTTS) {
                throw new Error('No compatible models found for one or more required types');
            }
        } catch (error) {
            throw new Error(`Model version validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async extractModelVersion(model: ModelInfo): Promise<string | null> {
        try {
            // First check for version in model metadata
            const metadataPath = path.join(model.extractedPath, 'metadata.json');
            if (fsSync.existsSync(metadataPath)) {
                const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
                if (metadata.version) {
                    return metadata.version;
                }
            }

            // Try to extract version from model name
            const versionMatch = model.name.match(/v?(\d+\.\d+\.\d+)/);
            if (versionMatch) {
                return versionMatch[1];
            }

            // Try to extract from config file for TTS models
            if (model.type === 'tts') {
                const configPath = path.join(model.extractedPath, `${model.name}.onnx.json`);
                if (fsSync.existsSync(configPath)) {
                    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
                    if (config.version) {
                        return config.version;
                    }
                }
            }

            this.logger(`Could not determine version for model: ${model.name}`);
            return null;
        } catch (error) {
            this.logger(`Error extracting model version: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return null;
        }
    }

    async ensureModelsDownloaded(): Promise<void> {
        try {
            await this.scanModels();
            for (const model of this.availableModels) {
                if (!await this.validateModelPath(model.compressedPath)) {
                    await this.downloadModel(model);
                }
                if (!await this.validateModelPath(model.extractedPath)) {
                    await this.extractModel(model.compressedPath);
                }
            }
        } catch (error) {
            this.logger(`Failed to ensure models: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    async validateModels(): Promise<void> {
        const versionManager = VersionManager.getInstance();
        const targetVersion = await versionManager.determineTargetVersion();
        await this.validateModelVersions(targetVersion);
    }

    private async downloadModel(model: ModelInfo): Promise<void> {
        try {
            this.logger(`Downloading model: ${model.name}`);
            const modelUrl = await this.getModelDownloadUrl(model);
            const response = await fetch(modelUrl);
            
            if (!response.ok) {
                throw new Error(`Failed to download model: ${response.statusText}`);
            }

            const buffer = await response.arrayBuffer();
            await fs.writeFile(model.compressedPath, Buffer.from(buffer));
            
            this.logger(`Model downloaded successfully: ${model.name}`);
        } catch (error) {
            this.logger(`Error downloading model: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    private async getModelDownloadUrl(model: ModelInfo): Promise<string> {
        try {
            const versionManager = VersionManager.getInstance();
            const version = await versionManager.determineTargetVersion();
            const baseUrl = 'https://github.com/k2-fsa/sherpa-onnx/releases/download';
            
            // Construct URL based on model type and version
            const modelType = model.type === 'stt' ? 'asr' : 'tts';
            const modelVariant = model.type === 'stt' ? 'zipformer' : 'vits';
            
            return `${baseUrl}/v${version}/${modelType}-${modelVariant}-${model.name}.tar.bz2`;
        } catch (error) {
            this.logger(`Error generating model URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
}

export { ModelInfo };  // Re-export ModelInfo if needed elsewhere 