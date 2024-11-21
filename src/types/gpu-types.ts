export interface GPUInfo {
    isAvailable: boolean;
    deviceId: number;
    type: 'cuda' | 'metal' | 'rocm' | 'none';
    version?: string;
}

export interface GPUCapabilities {
    hasCUDA: boolean;
    hasMetal: boolean;
    hasROCm: boolean;
    cudaVersion?: string;
    metalVersion?: string;
    rocmVersion?: string;
} 