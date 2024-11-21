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
        method: 'greedy_search' | 'modified_beam_search';
        numActivePaths?: number;
        beamSize?: number;
        temperature?: number;
    };
    enableEndpoint: boolean;
    rule1MinTrailingSilence: number;
    modelPath?: string;
    useGPU?: boolean;
    hotwordsFile?: string;
}

export interface TTSConfig {
    model: string;
    modelConfig: string;
    tokens: string;
    numThreads: number;
    debug?: boolean;
    noiseScale?: number;
    lengthScale?: number;
    noiseW?: number;
} 