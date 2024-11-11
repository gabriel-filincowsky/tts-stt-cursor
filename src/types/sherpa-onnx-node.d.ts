declare module 'sherpa-onnx-node' {
    export interface SherpaConfig {
        modelPath: string;
        deviceId: number;  // CPU = -1, GPU = 0,1,etc.
    }

    export interface STTConfig extends SherpaConfig {
        sampleRate: number;
        channels: number;
    }

    export interface TTSConfig extends SherpaConfig {
        speakerId?: number;
        speed?: number;
    }

    export function init(): Promise<void>;
    export function transcribe(config: STTConfig, audioData: ArrayBuffer): Promise<string>;
    export function synthesize(config: TTSConfig, text: string): Promise<ArrayBuffer>;
} 