export interface VersionInfo {
    sherpaNode: string;
    binaries: string;
    lastVerified: string;
    platform?: {
        [key: string]: {
            lastCheck: string;
            status: 'verified' | 'pending' | 'failed' | 'unverified';
            error?: string;
            apiData?: {
                assetId: string;
                sha256: string;
                lastChecked: string;
            };
        };
    };
    api?: {
        lastCheck: string;
        rateLimit: {
            remaining: number;
            reset: number;
        };
    };
} 