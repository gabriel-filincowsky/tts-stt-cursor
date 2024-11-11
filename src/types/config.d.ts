export interface TTSConfig {
    model: string;
    modelConfig: string;
    tokens: string;
    numThreads: number;
    debug: boolean;
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
        method: "greedy_search" | "modified_beam_search";
    };
    enableEndpoint: boolean;
    modelConfig: string;
    rule1MinTrailingSilence: number;
    decoderConfig: Record<string, unknown>;
    hotwordsFile: string;
    hotwordsScore: number;
} 