import { STTConfig } from "../types/config";

import { TTSConfig } from "../types/config";
import { validateSTTConfig, validateTTSConfig } from "./config-validator";
import { VersionManager } from '../utils/version-manager';
import { GPUManager } from '../utils/gpu-manager';
import { PLATFORM_CONFIGS } from '../types/platform-config';
import { meetsMinimumVersion } from './version-utils';

export class SherpaInitializationError extends Error {
    constructor(message: string, public details: string[]) {
        super(message);
        this.name = 'SherpaInitializationError';
    }
}

export class VersionMismatchError extends Error {
    constructor(
        message: string, 
        public expected: string, 
        public actual: string,
        public platform?: string,
        public details?: string[]
    ) {
        super(message);
        this.name = 'VersionMismatchError';
    }

    public toString(): string {
        let result = `${this.message}\nExpected: ${this.expected}\nActual: ${this.actual}`;
        if (this.platform) {
            result += `\nPlatform: ${this.platform}`;
        }
        if (this.details?.length) {
            result += `\nDetails:\n${this.details.map(d => `- ${d}`).join('\n')}`;
        }
        return result;
    }
}

export class GPUInitializationError extends Error {
    constructor(message: string, public details: string[]) {
        super(message);
        this.name = 'GPUInitializationError';
    }
}

export class NativeLayerError extends Error {
    constructor(
        message: string,
        public nativeStack?: string,
        public context?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'NativeLayerError';
    }

    toString(): string {
        let result = `${this.message}\n`;
        if (this.nativeStack) {
            result += `Native Stack:\n${this.nativeStack}\n`;
        }
        if (this.context) {
            result += `Context:\n${JSON.stringify(this.context, null, 2)}`;
        }
        return result;
    }
}

export async function validateAndInitialize(
    config: STTConfig | TTSConfig, 
    type: 'stt' | 'tts'
): Promise<void> {
    const versionManager = VersionManager.getInstance();
    const platform = process.platform;
    const arch = process.arch;
    const gpuManager = GPUManager.getInstance();
    const hasGPU = await gpuManager.checkGPUAvailability();
    
    // First check version compatibility
    const isVersionValid = await versionManager.validateVersion();
    if (!isVersionValid) {
        throw new VersionMismatchError(
            'Version mismatch detected',
            versionManager.getExpectedVersion(),
            versionManager.getActualVersion(),
            `${platform}-${arch}`,
            ['Binary files may be missing or corrupted', 'Version information mismatch']
        );
    }

    // Then validate configuration
    const errors = await (type === 'stt' 
        ? validateSTTConfig(config as STTConfig)
        : validateTTSConfig(config as TTSConfig));

    if (errors.length > 0) {
        throw new SherpaInitializationError(
            `Invalid ${type.toUpperCase()} configuration`,
            errors
        );
    }

    if (hasGPU) {
        try {
            // GPU-specific validation
            const cudaVersion = await gpuManager.getCUDAVersion();
            const platformConfig = PLATFORM_CONFIGS[`${process.platform}-${process.arch}`];
            
            if (platformConfig?.gpuSupport?.cudaMinVersion && cudaVersion) {
                if (!meetsMinimumVersion(cudaVersion, platformConfig.gpuSupport.cudaMinVersion)) {
                    throw new Error(`CUDA version ${cudaVersion} does not meet minimum requirement ${platformConfig.gpuSupport.cudaMinVersion}`);
                }
            }
        } catch (error) {
            throw new GPUInitializationError(
                'GPU initialization failed',
                [error instanceof Error ? error.message : 'Unknown error']
            );
        }
    }
}

export async function handleGPUError(error: GPUInitializationError): Promise<void> {
    // Implementation needed
}

export function handleNativeError(error: unknown): never {
    if (error instanceof Error) {
        throw new NativeLayerError(
            error.message,
            error.stack,
            { timestamp: new Date().toISOString() }
        );
    }
    throw new NativeLayerError('Unknown native error');
} 