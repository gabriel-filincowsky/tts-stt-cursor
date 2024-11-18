import { outputChannel } from './output-channel';
import { GPUManager } from './gpu-manager';

export class GPUContext {
    private static instance: GPUContext;
    private initialized: boolean = false;
    
    private constructor() {}

    static getInstance(): GPUContext {
        if (!this.instance) {
            this.instance = new GPUContext();
        }
        return this.instance;
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            const gpuManager = GPUManager.getInstance();
            const hasGPU = await gpuManager.checkGPUAvailability();

            if (hasGPU) {
                // Set CUDA environment variables
                process.env.CUDA_VISIBLE_DEVICES = '0';
                // Add other GPU-specific initialization
                outputChannel.appendLine('GPU context initialized successfully');
            } else {
                outputChannel.appendLine('No GPU available, using CPU context');
            }

            this.initialized = true;
        } catch (error) {
            outputChannel.appendLine(`GPU context initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    async cleanup(): Promise<void> {
        if (!this.initialized) return;

        try {
            // Add cleanup logic if needed
            this.initialized = false;
            outputChannel.appendLine('GPU context cleaned up successfully');
        } catch (error) {
            outputChannel.appendLine(`GPU context cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
} 