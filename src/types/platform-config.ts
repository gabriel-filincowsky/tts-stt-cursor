export interface GPUSupport {
    cudaMinVersion?: string;
    metalMinVersion?: string;
    rocmSupport?: {
        minVersion: string;
    };
    requiredLibraries: string[];
    requiredFiles: string[];
    fallbackToCPU?: boolean;
    environmentVariables?: {
        [key: string]: string;
    };
}

export interface PlatformConfig {
    binaryName: string;
    libraryPath: string;
    binaryPattern: string;
    requiredFiles: string[];
    gpuSupport?: GPUSupport;
    environmentVariables: {
        [key: string]: string;
    };
}

export const PLATFORM_CONFIGS: { [key: string]: PlatformConfig } = {
    'win32-x64': {
        binaryName: 'sherpa-onnx.dll',
        libraryPath: 'PATH',
        binaryPattern: 'sherpa-onnx-v{version}-win-x64',
        requiredFiles: ['sherpa-onnx.dll', 'onnxruntime.dll'],
        gpuSupport: {
            cudaMinVersion: '11.0.0',
            requiredLibraries: ['cudart64_110.dll', 'cublas64_110.dll'],
            requiredFiles: ['sherpa-onnx-cuda.dll', 'onnxruntime-cuda.dll']
        },
        environmentVariables: {
            'PATH': '%PATH%;%NATIVE_DIR%'
        }
    },
    'linux-x64': {
        binaryName: 'libsherpa-onnx.so',
        libraryPath: 'LD_LIBRARY_PATH',
        binaryPattern: 'sherpa-onnx-v{version}-linux-x64',
        requiredFiles: ['libsherpa-onnx.so', 'libonnxruntime.so'],
        gpuSupport: {
            cudaMinVersion: '11.0',
            rocmSupport: {
                minVersion: '5.0'
            },
            fallbackToCPU: true,
            requiredLibraries: ['libcudart.so', 'libcublas.so'],
            requiredFiles: ['libsherpa-onnx-cuda.so', 'libonnxruntime-cuda.so'],
            environmentVariables: {
                'CUDA_VISIBLE_DEVICES': '0'
            }
        },
        environmentVariables: {
            'LD_LIBRARY_PATH': '{nativeDir}'
        }
    },
    'darwin-x64': {
        binaryName: 'libsherpa-onnx.dylib',
        libraryPath: 'DYLD_LIBRARY_PATH',
        binaryPattern: 'sherpa-onnx-v{version}-darwin-x64',
        requiredFiles: ['libsherpa-onnx.dylib', 'libonnxruntime.dylib'],
        gpuSupport: {
            fallbackToCPU: true,
            requiredLibraries: ['libMetal.dylib'],
            requiredFiles: ['libsherpa-onnx-metal.dylib', 'libonnxruntime-metal.dylib'],
            environmentVariables: {
                'METAL_DEVICE_WRAPPER_TYPE': 'MTLDevice'
            }
        },
        environmentVariables: {
            'DYLD_LIBRARY_PATH': '{nativeDir}'
        }
    },
    'darwin-arm64': {
        binaryName: 'libsherpa-onnx.dylib',
        libraryPath: 'DYLD_LIBRARY_PATH',
        binaryPattern: 'sherpa-onnx-v{version}-darwin-arm64',
        requiredFiles: ['libsherpa-onnx.dylib', 'libonnxruntime.dylib'],
        gpuSupport: {
            fallbackToCPU: true,
            requiredLibraries: ['libMetal.dylib'],
            requiredFiles: ['libsherpa-onnx-metal.dylib', 'libonnxruntime-metal.dylib'],
            environmentVariables: {
                'METAL_DEVICE_WRAPPER_TYPE': 'MTLDevice'
            }
        },
        environmentVariables: {
            'DYLD_LIBRARY_PATH': '{nativeDir}'
        }
    }
}; 