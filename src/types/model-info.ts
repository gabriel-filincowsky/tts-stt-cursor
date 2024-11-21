export interface ModelInfo {
    name: string;
    type: 'stt' | 'tts';
    compressedPath: string;
    extractedPath: string;
    status?: 'compatible' | 'incompatible' | 'pending';
    version?: string;
} 