import { TTSConfig, STTConfig } from '../types/config';
import * as fs from 'fs/promises';

export async function validateTTSConfig(config: TTSConfig): Promise<string[]> {
    const errors: string[] = [];
    
    // Check required files exist
    for (const path of [config.model, config.modelConfig, config.tokens]) {
        try {
            await fs.access(path);
        } catch {
            errors.push(`File not found: ${path}`);
        }
    }

    // Validate numThreads
    if (config.numThreads < 1) {
        errors.push('numThreads must be greater than 0');
    }

    return errors;
}

export async function validateSTTConfig(config: STTConfig): Promise<string[]> {
    const errors: string[] = [];
    
    // Check required files exist
    const files = [
        config.transducer.encoder,
        config.transducer.decoder,
        config.transducer.joiner,
        config.tokens,
        config.modelConfig
    ];

    for (const path of files) {
        try {
            await fs.access(path);
        } catch {
            errors.push(`File not found: ${path}`);
        }
    }

    // Validate feature config
    if (config.featConfig.sampleRate !== 16000) {
        errors.push('Sample rate must be 16000');
    }
    if (config.featConfig.featureDim !== 80) {
        errors.push('Feature dimension must be 80');
    }

    return errors;
} 