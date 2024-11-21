import { TTSConfig, STTConfig } from '../types/config';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { inspect } from 'util';
import { outputChannel } from './output-channel';
import { VersionManager } from '../utils/version-manager';
import { GPUManager } from './gpu-manager';

async function validateVersionCompatibility(config: any, targetVersion: string): Promise<boolean> {
    try {
        // Basic version compatibility check
        if (config.version && config.version !== targetVersion) {
            outputChannel.appendLine(`Version mismatch: config version ${config.version} != target version ${targetVersion}`);
            return false;
        }

        // Add more specific validation as needed
        return true;
    } catch (error) {
        outputChannel.appendLine(`Version compatibility check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
    }
}

export async function validateConfig(config: any, type: 'STT' | 'TTS'): Promise<string[]> {
    const errors: string[] = [];
    const versionManager = VersionManager.getInstance();
    const targetVersion = await versionManager.determineTargetVersion();

    // Add version compatibility check
    if (!await validateVersionCompatibility(config, targetVersion)) {
        errors.push(`${type} configuration is not compatible with version ${targetVersion}`);
    }

    // ... rest of validation logic ...
    return errors;
}

export async function validateTTSConfig(config: TTSConfig): Promise<string[]> {
    const errors: string[] = [];
    outputChannel.appendLine('\n=== Detailed TTS Config Validation ===');
    
    // Log full config for inspection
    outputChannel.appendLine('\nReceived Configuration:');
    outputChannel.appendLine(inspect(config, { depth: null, colors: false }));
    
    // Validate and log file details
    const files = [
        { path: config.model, type: 'Model' },
        { path: config.modelConfig, type: 'Model Config' },
        { path: config.tokens, type: 'Tokens' }
    ];

    outputChannel.appendLine('\nFile Validation:');
    for (const { path, type } of files) {
        outputChannel.appendLine(`\nChecking ${type} file: ${path}`);
        try {
            const exists = fsSync.existsSync(path);
            outputChannel.appendLine(`- Exists: ${exists ? '✅' : '❌'}`);
            
            if (exists) {
                const stats = await fs.stat(path);
                outputChannel.appendLine(`- Size: ${stats.size} bytes`);
                outputChannel.appendLine(`- Last modified: ${stats.mtime}`);
                
                if (type === 'Model Config') {
                    try {
                        const content = await fs.readFile(path, 'utf8');
                        const parsed = JSON.parse(content);
                        outputChannel.appendLine('- Config content validation:');
                        outputChannel.appendLine(inspect(parsed, { depth: 2, colors: false }));
                    } catch (e) {
                        outputChannel.appendLine(`- ❌ Error reading config: ${e instanceof Error ? e.message : 'Unknown error'}`);
                        errors.push(`Invalid model config file: ${e instanceof Error ? e.message : 'Unknown error'}`);
                    }
                }
            } else {
                errors.push(`File not found: ${path}`);
            }
        } catch (e) {
            outputChannel.appendLine(`- ❌ Error accessing file: ${e instanceof Error ? e.message : 'Unknown error'}`);
            errors.push(`File access error: ${path}`);
        }
    }

    // Parameter validation with detailed logging
    outputChannel.appendLine('\nParameter Validation:');
    outputChannel.appendLine(`- numThreads: ${config.numThreads} ${config.numThreads > 0 ? '✅' : '❌'}`);
    if (config.numThreads < 1) {
        errors.push('numThreads must be greater than 0');
    }

    // Optional parameters
    outputChannel.appendLine('\nOptional Parameters:');
    outputChannel.appendLine(`- noiseScale: ${config.noiseScale ?? 'not set'}`);
    outputChannel.appendLine(`- lengthScale: ${config.lengthScale ?? 'not set'}`);
    outputChannel.appendLine(`- noiseW: ${config.noiseW ?? 'not set'}`);

    if (errors.length > 0) {
        outputChannel.appendLine('\n❌ Validation Errors:');
        errors.forEach(error => outputChannel.appendLine(`- ${error}`));
    } else {
        outputChannel.appendLine('\n✅ All validations passed');
    }

    return errors;
}

export async function validateSTTConfig(config: STTConfig): Promise<string[]> {
    const errors: string[] = [];
    outputChannel.appendLine('\n=== Detailed STT Config Validation ===');
    
    // Log full config
    outputChannel.appendLine('\nReceived Configuration:');
    outputChannel.appendLine(inspect(config, { depth: null, colors: false }));
    
    // Validate transducer files
    outputChannel.appendLine('\nTransducer File Validation:');
    const files = [
        { path: config.transducer.encoder, type: 'Encoder' },
        { path: config.transducer.decoder, type: 'Decoder' },
        { path: config.transducer.joiner, type: 'Joiner' },
        { path: config.tokens, type: 'Tokens' }
    ];

    for (const { path, type } of files) {
        outputChannel.appendLine(`\nChecking ${type} file: ${path}`);
        try {
            const exists = fsSync.existsSync(path);
            outputChannel.appendLine(`- Exists: ${exists ? '✅' : '❌'}`);
            
            if (exists) {
                const stats = await fs.stat(path);
                outputChannel.appendLine(`- Size: ${stats.size} bytes`);
                outputChannel.appendLine(`- Last modified: ${stats.mtime}`);
            } else {
                errors.push(`${type} file not found: ${path}`);
            }
        } catch (e) {
            outputChannel.appendLine(`- ❌ Error accessing file: ${e instanceof Error ? e.message : 'Unknown error'}`);
            errors.push(`${type} file access error: ${path}`);
        }
    }

    // Feature config validation
    outputChannel.appendLine('\nFeature Configuration:');
    outputChannel.appendLine(`- Sample Rate: ${config.featConfig.sampleRate} ${config.featConfig.sampleRate === 16000 ? '✅' : '❌'}`);
    outputChannel.appendLine(`- Feature Dimension: ${config.featConfig.featureDim} ${config.featConfig.featureDim === 80 ? '✅' : '❌'}`);

    if (config.featConfig.sampleRate !== 16000) {
        errors.push('Sample rate must be 16000');
    }
    if (config.featConfig.featureDim !== 80) {
        errors.push('Feature dimension must be 80');
    }

    // Decoding method validation
    outputChannel.appendLine('\nDecoding Configuration:');
    outputChannel.appendLine(`- Method: ${config.decodingConfig.method}`);
    if (!['greedy_search', 'modified_beam_search'].includes(config.decodingConfig.method)) {
        errors.push('Invalid decoding method');
    }

    // Additional parameters
    outputChannel.appendLine('\nAdditional Parameters:');
    outputChannel.appendLine(`- Enable Endpoint: ${config.enableEndpoint}`);
    outputChannel.appendLine(`- Rule1 Min Trailing Silence: ${config.rule1MinTrailingSilence}`);
    
    if (config.hotwordsFile) {
        outputChannel.appendLine(`- Hotwords File: ${config.hotwordsFile}`);
        const exists = await fs.access(config.hotwordsFile).then(() => true).catch(() => false);
        outputChannel.appendLine(`  Status: ${exists ? '✅' : '❌'}`);
        if (!exists) {
            errors.push(`Hotwords file not found: ${config.hotwordsFile}`);
        }
    }

    // Validate model paths
    if (!await validateModelPath(config.modelPath)) {
        errors.push(`Invalid model path: ${config.modelPath}`);
    }

    // Validate GPU configuration if enabled
    if (config.useGPU) {
        const gpuManager = GPUManager.getInstance();
        if (!await gpuManager.checkGPUAvailability()) {
            errors.push('GPU requested but not available');
        }
    }

    if (errors.length > 0) {
        outputChannel.appendLine('\n❌ Validation Errors:');
        errors.forEach(error => outputChannel.appendLine(`- ${error}`));
    } else {
        outputChannel.appendLine('\n✅ All validations passed');
    }

    return errors;
}

async function validateModelPath(modelPath: string | undefined): Promise<boolean> {
    if (!modelPath) {
        return false;
    }
    try {
        await fs.access(modelPath);
        return true;
    } catch {
        return false;
    }
} 