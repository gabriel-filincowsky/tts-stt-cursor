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
        method: "greedy_search" | "modified_beam_search";  // Changed from string to literal type union
    };
    enableEndpoint: boolean;
    rule1MinTrailingSilence: number;
    decoderConfig: Record<string, unknown>;
    hotwordsFile?: string;
    hotwordsScore?: number;
}