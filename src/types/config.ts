export interface STTConfig {
    transducer: {
        encoder: string;
        decoder: string;
        joiner: string;
    };
    tokens: string;
    featConfig: {
        sampleRate: number;
        featureDim: number;
    };
    decodingConfig: {
        method: string;
    };
    enableEndpoint: boolean;
    rule1MinTrailingSilence: number;
    decoderConfig: Record<string, unknown>;
    hotwordsFile: string;
    hotwordsScore: number;
}

export interface TTSConfig {
    model: string;
    modelConfig: string;
    tokens: string;
    numThreads: number;
    debug: boolean;
    noiseScale?: number;
    lengthScale?: number;
    noiseW?: number;
} 