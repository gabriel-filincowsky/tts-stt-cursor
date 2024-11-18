import { ModelInfo } from '../types/model-info';
import * as path from 'path';

export async function getModelPaths(modelInfo: ModelInfo, type: 'stt' | 'tts'): Promise<{[key: string]: string}> {
    const modelDir = modelInfo.extractedPath;
    
    if (type === 'stt') {
        return {
            encoder: path.join(modelDir, 'encoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx'),
            decoder: path.join(modelDir, 'decoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx'),
            joiner: path.join(modelDir, 'joiner-epoch-99-avg-1-chunk-16-left-128.int8.onnx'),
            tokens: path.join(modelDir, 'tokens.txt')
        };
    } else {
        return {
            model: path.join(modelDir, 'en_US-amy-low.onnx'),
            modelConfig: path.join(modelDir, 'en_US-amy-low.onnx.json'),
            tokens: path.join(modelDir, 'tokens.txt')
        };
    }
} 