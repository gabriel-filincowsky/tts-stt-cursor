export interface VersionInfo {
    sherpaNode: string;
    binaries: string;
    lastVerified: string;
    platform?: {
        [key: string]: {
            lastCheck: string;
            status: 'verified' | 'pending' | 'failed';
        };
    };
} 