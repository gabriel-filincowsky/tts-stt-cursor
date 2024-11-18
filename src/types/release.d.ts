export interface Release {
    tag_name: string;
    prerelease: boolean;
    assets: Array<{
        name: string;
        browser_download_url: string;
        size: number;
        content_type: string;
    }>;
} 