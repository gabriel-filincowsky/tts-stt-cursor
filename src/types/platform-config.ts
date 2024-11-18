export interface GPUSupportConfig {
    cudaMinVersion?: string;
    rocmMinVersion?: string;
    fallbackToCPU: boolean;
    requiredFiles: string[];
    environmentVariables?: {
        [key: string]: string;
    };
}

export interface PlatformConfig {
    platform: string;
    arch: string;
    requiredFiles: string[];
    binaryPattern: string;
    libraryPaths: string[];
    environmentVariables: {
        [key: string]: string;
    };
    gpuSupport?: GPUSupportConfig;
}

export const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
    'win32-x64': {
        platform: 'win',
        arch: 'x64',
        requiredFiles: ['sherpa-onnx.dll', 'onnxruntime.dll'],
        binaryPattern: 'sherpa-onnx-v{version}-win-x64',
        libraryPaths: ['bin', 'lib'],
        environmentVariables: {
            'PATH': '{nativeDir}'
        },
        gpuSupport: {
            cudaMinVersion: '11.0',
            fallbackToCPU: true,
            requiredFiles: ['sherpa-onnx-cuda.dll', 'onnxruntime-cuda.dll'],
            environmentVariables: {
                'CUDA_VISIBLE_DEVICES': '0'
            }
        }
    },
    'linux-x64': {
        platform: 'linux',
        arch: 'x64',
        requiredFiles: ['libsherpa-onnx.so', 'libonnxruntime.so'],
        binaryPattern: 'sherpa-onnx-v{version}-linux-x64.tar.gz',
        libraryPaths: ['lib'],
        environmentVariables: {
            'LD_LIBRARY_PATH': '{nativeDir}'
        },
        gpuSupport: {
            cudaMinVersion: '11.0',
            rocmMinVersion: '5.0',
            fallbackToCPU: true,
            requiredFiles: ['libsherpa-onnx-cuda.so', 'libonnxruntime-cuda.so'],
            environmentVariables: {
                'CUDA_VISIBLE_DEVICES': '0'
            }
        }
    },
    'darwin-x64': {
        platform: 'darwin',
        arch: 'x64',
        requiredFiles: ['libsherpa-onnx.dylib', 'libonnxruntime.dylib'],
        binaryPattern: 'sherpa-onnx-v{version}-darwin-x64.tar.gz',
        libraryPaths: ['lib'],
        environmentVariables: {
            'DYLD_LIBRARY_PATH': '{nativeDir}'
        },
        gpuSupport: {
            fallbackToCPU: true,
            requiredFiles: ['libsherpa-onnx-metal.dylib', 'libonnxruntime-metal.dylib'],
            environmentVariables: {
                'METAL_DEVICE_WRAPPER_TYPE': 'MTLDevice'
            }
        }
    },
    'darwin-arm64': {
        platform: 'darwin',
        arch: 'arm64',
        requiredFiles: ['libsherpa-onnx.dylib', 'libonnxruntime.dylib'],
        binaryPattern: 'sherpa-onnx-v{version}-darwin-arm64.tar.gz',
        libraryPaths: ['lib'],
        environmentVariables: {
            'DYLD_LIBRARY_PATH': '{nativeDir}'
        },
        gpuSupport: {
            fallbackToCPU: true,
            requiredFiles: ['libsherpa-onnx-metal.dylib', 'libonnxruntime-metal.dylib'],
            environmentVariables: {
                'METAL_DEVICE_WRAPPER_TYPE': 'MTLDevice'
            }
        }
    }
}; 