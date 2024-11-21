import { STTConfig, TTSConfig } from "../types/config";
import { validateSTTConfig, validateTTSConfig } from "./config-validator";
import { VersionManager } from './version-manager';
import { GPUManager } from './gpu-manager';
import { PLATFORM_CONFIGS } from '../types/platform-config';
import { meetsMinimumVersion } from './version-utils';
import { outputChannel } from './output-channel';
import * as path from 'path';

export class APIError extends Error {
    constructor(
        message: string,
        public statusCode?: number,
        public rateLimitRemaining?: number,
        public rateLimitReset?: number
    ) {
        super(message);
        this.name = 'APIError';
    }
}

export class RateLimitError extends APIError {
    constructor(resetTime: number) {
        super('GitHub API rate limit exceeded', 429, 0, resetTime);
        this.name = 'RateLimitError';
    }
}

export class AssetNotFoundError extends Error {
    constructor(
        message: string,
        public platform: string,
        public arch: string,
        public version: string
    ) {
        super(message);
        this.name = 'AssetNotFoundError';
    }
}

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

export class AntivirusBlockError extends Error {
    constructor(message: string, public filePath: string) {
        super(message);
        this.name = 'AntivirusBlockError';
    }
}

export class BinaryInstallationError extends Error {
    public readonly cause?: Error;
    
    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = 'BinaryInstallationError';
        if (cause instanceof Error) {
            this.cause = cause;
        }
    }
}

export async function validateAndInitialize(
    config: STTConfig | TTSConfig, 
    type: 'stt' | 'tts'
): Promise<void> {
    try {
        const versionManager = VersionManager.getInstance();
        const targetVersion = await versionManager.determineTargetVersion();
        
        // Check version compatibility first
        if (!await versionManager.validateVersionState(targetVersion)) {
            throw new Error('Version validation must be completed before initialization');
        }
        
        const platform = process.platform;
        const arch = process.arch;
        const gpuManager = GPUManager.getInstance();
        const hasGPU = await gpuManager.checkGPUAvailability();
        
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
    } catch (error) {
        throw new SherpaInitializationError(
            'Initialization failed',
            [error instanceof Error ? error.message : 'Unknown error']
        );
    }
}

function handleInitializationError(error: unknown): void {
    if (error instanceof BinaryInstallationError) {
        outputChannel.appendLine('Binary installation failed. Please check your system configuration.');
        return;
    }
    if (error instanceof APIError || 
        error instanceof VersionMismatchError || 
        error instanceof GPUInitializationError ||
        error instanceof SherpaInitializationError) {
        throw error;
    }
    if (error instanceof AntivirusBlockError) {
        outputChannel.appendLine(`
            Antivirus may be blocking file: ${error.filePath}
            Please add an exception in your antivirus software for:
            - ${path.dirname(error.filePath)}
            Or temporarily disable real-time scanning during installation.
        `);
    }
    throw new SherpaInitializationError(
        'Initialization failed',
        [error instanceof Error ? error.message : 'Unknown error']
    );
}

export async function handleGPUError(error: GPUInitializationError): Promise<void> {
    outputChannel.appendLine('Handling GPU initialization error...');
    
    try {
        const gpuManager = GPUManager.getInstance();
        const platform = process.platform;
        const arch = process.arch;
        
        // Log detailed error information
        outputChannel.appendLine(`GPU Error: ${error.message}`);
        error.details.forEach(detail => outputChannel.appendLine(`  - ${detail}`));
        
        // Check if fallback to CPU is possible
        const platformConfig = PLATFORM_CONFIGS[`${platform}-${arch}`];
        if (platformConfig?.gpuSupport?.fallbackToCPU) {
            outputChannel.appendLine('Attempting fallback to CPU...');
            
            // Update configuration to use CPU
            await gpuManager.disableGPU();
            
            // Re-initialize with CPU configuration
            const versionManager = VersionManager.getInstance();
            await versionManager.ensureInitialSetup();
            
            outputChannel.appendLine('Successfully fell back to CPU configuration');
        } else {
            throw new Error('GPU initialization failed and CPU fallback is not available');
        }
    } catch (fallbackError) {
        outputChannel.appendLine(`Failed to handle GPU error: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
        throw fallbackError;
    }
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