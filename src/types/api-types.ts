export interface SherpaAsset {
    name: string;
    browser_download_url: string;
    size: number;
    sha256?: string;
    platform: {
        os: string;
        arch: string;
        type: 'cpu' | 'gpu';
        variant?: 'shared' | 'static';
    };
    requiredFiles: string[];
    compatibility?: {
        cuda?: string;
        rocm?: string;
        metal?: boolean;
    };
}

export interface SherpaRelease {
    version: string;
    tag_name: string;
    prerelease: boolean;
    assets: SherpaAsset[];
    models?: {
        stt: {
            version: string;
            compatibility: string[];
            url: string;
        }[];
        tts: {
            version: string;
            compatibility: string[];
            url: string;
        }[];
    };
}

export interface APIConfig {
    endpoints: {
        releases: string;
        assets: string;
        models: string;
    };
    cache: {
        duration: number;
        path: string;
    };
    auth?: {
        token?: string;
    };
} 