declare module 'sherpa-onnx-node' {
    interface TransducerConfig {
        encoder: string;
        decoder: string;
        joiner: string;
    }

    interface FeatConfig {
        sampleRate: number;
        featureDim: number;
    }

    interface DecodingConfig {
        method: "greedy_search" | "modified_beam_search";
    }

    export interface OnlineRecognizerConfig {
        transducer: TransducerConfig;
        tokens: string;
        modelConfig?: string;
        featConfig: FeatConfig;
        decodingConfig: DecodingConfig;
        enableEndpoint?: boolean;
        rule1MinTrailingSilence?: number;
        decoderConfig?: Record<string, unknown>;
        hotwordsFile?: string;
        hotwordsScore?: number;
    }

    export interface OfflineTtsConfig {
        model: string;
        modelConfig: string;
        tokens: string;
        numThreads?: number;
        debug?: boolean;
    }

    export class OnlineRecognizer {
        constructor(config: OnlineRecognizerConfig);
        acceptWaveform(samples: Float32Array): void;
        decode(): void;
        getResult(): string;
        reset(): void;
    }

    export class OfflineTts {
        constructor(config: OfflineTtsConfig);
        generate(text: string): { sampleRate: number; samples: Float32Array };
    }
} 