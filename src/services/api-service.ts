import * as https from 'https';
import * as fs from 'fs/promises';
import * as path from 'path';
import { outputChannel } from '../utils/output-channel';
import { SherpaRelease, APIConfig, SherpaAsset } from '../types/api-types';
import { PLATFORM_CONFIGS } from '../types/platform-config';
import * as semver from 'semver';

export class APIError extends Error {
    constructor(
        message: string,
        public statusCode?: number
    ) {
        super(message);
        this.name = 'APIError';
    }
}

interface AssetPlatformInfo {
    os: string;
    arch: string;
    type: 'cpu' | 'gpu';
    variant?: 'shared' | 'static';
}

export class APIService {
    private static instance: APIService;
    private cache: Map<string, { data: any; timestamp: number }> = new Map();
    private rateLimitRemaining: number = 60;
    private rateLimitReset: number = 0;

    private constructor(private config: APIConfig) {}

    static getInstance(config: APIConfig): APIService {
        if (!APIService.instance) {
            APIService.instance = new APIService(config);
        }
        return APIService.instance;
    }

    private async makeRequest<T>(url: string): Promise<T> {
        if (this.rateLimitRemaining <= 1) {
            const now = Date.now() / 1000;
            if (now < this.rateLimitReset) {
                throw new Error('API rate limit exceeded');
            }
        }

        const cacheKey = url;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.config.cache.duration) {
            return cached.data as T;
        }

        return new Promise((resolve, reject) => {
            const options = {
                headers: {
                    'User-Agent': 'tts-stt-cursor',
                    'Accept': 'application/vnd.github.v3+json',
                    ...(this.config.auth?.token && {
                        'Authorization': `token ${this.config.auth.token}`
                    })
                }
            };

            https.get(url, options, (response) => {
                const rateLimit = response.headers['x-ratelimit-remaining'];
                const rateLimitReset = response.headers['x-ratelimit-reset'];
                
                this.rateLimitRemaining = typeof rateLimit === 'string' ? 
                    parseInt(rateLimit) : 60;
                this.rateLimitReset = typeof rateLimitReset === 'string' ? 
                    parseInt(rateLimitReset) : 0;

                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        this.cache.set(cacheKey, {
                            data: result,
                            timestamp: Date.now()
                        });
                        resolve(result as T);
                    } catch (err) {
                        reject(err);
                    }
                });
            }).on('error', reject);
        });
    }

    async getReleases(): Promise<SherpaRelease[]> {
        return this.makeRequest<SherpaRelease[]>(this.config.endpoints.releases);
    }

    private parseVersion(tagName: string): string {
        // Handle both 'v1.10.31' and '1.10.31' formats
        return tagName.replace(/^v/, '');
    }

    private async findCompatibleRelease(targetVersion: string): Promise<SherpaRelease | null> {
        const releases = await this.getReleases();
        
        // First try exact match
        let release = releases.find(r => 
            this.parseVersion(r.tag_name) === targetVersion
        );

        if (!release) {
            // Then try semver compatibility
            release = releases.find(r => 
                semver.satisfies(
                    this.parseVersion(r.tag_name),
                    `~${targetVersion}`  // Allows patch-level changes
                )
            );
        }

        return release || null;
    }

    async getCompatibleAssets(platform: string, arch: string): Promise<SherpaAsset[]> {
        try {
            const targetVersion = await this.getTargetVersion();
            const release = await this.findCompatibleRelease(targetVersion);
            
            if (!release) {
                throw new Error(`No compatible release found for version ${targetVersion}`);
            }

            outputChannel.appendLine(`Processing assets for platform ${platform}-${arch}`);

            const parsedAssets = new Map<string, AssetPlatformInfo | null>();

            return release.assets
                .map(asset => {
                    let platformInfo = parsedAssets.get(asset.name);
                    if (platformInfo === undefined) {
                        platformInfo = this.parseAssetPlatform(asset.name);
                        parsedAssets.set(asset.name, platformInfo);
                    }

                    if (!platformInfo) {
                        outputChannel.appendLine(`Skipping asset ${asset.name} - unable to parse platform info`);
                        return null;
                    }

                    outputChannel.appendLine(`Asset ${asset.name}: ${JSON.stringify(platformInfo)}`);

                    const requiredFiles = this.determineRequiredFiles(platformInfo);

                    return {
                        name: asset.name,
                        browser_download_url: asset.browser_download_url,
                        size: asset.size,
                        platform: platformInfo,
                        requiredFiles,
                        compatibility: this.determineCompatibility(asset.name)
                    } as SherpaAsset;
                })
                .filter((asset): asset is SherpaAsset => 
                    asset !== null && 
                    asset.platform.os === platform && 
                    asset.platform.arch === arch
                );
        } catch (error) {
            outputChannel.appendLine(`Failed to get compatible assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    private parseAssetPlatform(name: string): AssetPlatformInfo | null {
        // Handle various naming patterns
        const patterns = [
            // v1.10.31-win-x64-cuda.tar.bz2
            /^v?\d+\.\d+\.\d+-(\w+)-(\w+)(?:-(cuda|gpu))?(?:-(shared|static))?\.tar\.bz2$/,
            // sherpa-onnx-v1.10.31-win-x64-cuda.tar.bz2
            /^sherpa-onnx-v?\d+\.\d+\.\d+-(\w+)-(\w+)(?:-(cuda|gpu))?(?:-(shared|static))?\.tar\.bz2$/
        ];

        for (const pattern of patterns) {
            const match = name.match(pattern);
            if (match) {
                const [_, platform, arch, type, variant] = match;
                return {
                    os: this.normalizePlatform(platform),
                    arch: this.normalizeArch(arch),
                    type: type ? 'gpu' : 'cpu',
                    variant: variant as 'shared' | 'static' | undefined
                };
            }
        }

        return null;
    }

    private determineRequiredFiles(platformInfo: AssetPlatformInfo): string[] {
        const config = PLATFORM_CONFIGS[`${platformInfo.os}-${platformInfo.arch}`];
        if (!config) return [];

        if (platformInfo.type === 'gpu' && config.gpuSupport) {
            return [...config.requiredFiles, ...config.gpuSupport.requiredFiles];
        }

        return [...config.requiredFiles];
    }

    private determineCompatibility(assetName: string): { 
        cuda?: string; 
        rocm?: string; 
        metal?: boolean; 
    } | undefined {
        // Extract CUDA version if present
        const cudaMatch = assetName.match(/cuda[_-]?(\d+\.\d+)/i);
        if (cudaMatch) {
            return { cuda: cudaMatch[1] };
        }

        // Check for ROCm
        const rocmMatch = assetName.match(/rocm[_-]?(\d+\.\d+)/i);
        if (rocmMatch) {
            return { rocm: rocmMatch[1] };
        }

        // Check for Metal
        if (assetName.includes('metal')) {
            return { metal: true };
        }

        return undefined;
    }

    private normalizePlatform(platform: string): string {
        const platformMap: Record<string, string> = {
            'win': 'win32',
            'windows': 'win32',
            'osx': 'darwin',
            'macos': 'darwin'
        };
        return platformMap[platform.toLowerCase()] || platform;
    }

    private normalizeArch(arch: string): string {
        const archMap: Record<string, string> = {
            'x86_64': 'x64',
            'amd64': 'x64',
            'aarch64': 'arm64'
        };
        return archMap[arch.toLowerCase()] || arch;
    }

    async fetchRelease(version: string): Promise<SherpaRelease> {
        try {
            const response = await this.makeRequest(`/repos/k2-fsa/sherpa-onnx/releases/tags/v${version}`);
            return this.parseRelease(response);
        } catch (error) {
            if (error instanceof APIError && error.statusCode === 404) {
                throw new Error(`Version ${version} not found`);
            }
            throw error;
        }
    }

    async getLatestRelease(): Promise<SherpaRelease> {
        const response = await this.makeRequest('/repos/k2-fsa/sherpa-onnx/releases/latest');
        return this.parseRelease(response);
    }

    private parseRelease(data: any): SherpaRelease {
        return {
            tag_name: data.tag_name,
            prerelease: data.prerelease,
            version: data.tag_name.replace(/^v/, ''),
            assets: data.assets.map((asset: any) => ({
                name: asset.name,
                browser_download_url: asset.browser_download_url,
                size: asset.size
            }))
        };
    }

    async getCompatibleRelease(targetVersion: string): Promise<SherpaRelease> {
        const releases = await this.getReleases();
        const compatibleRelease = releases.find(release => 
            semver.satisfies(release.version, `~${targetVersion}`)
        );

        if (!compatibleRelease) {
            throw new Error(`No compatible release found for version ${targetVersion}`);
        }

        return compatibleRelease;
    }

    async getTargetVersion(): Promise<string> {
        try {
            const packageJson = require('../../package.json');
            return packageJson.dependencies['sherpa-onnx-node'].replace('^', '');
        } catch (error) {
            throw new Error('Failed to determine target version from package.json');
        }
    }

    private async handleRateLimit(headers: Record<string, string>): Promise<void> {
        this.rateLimitRemaining = parseInt(headers['x-ratelimit-remaining'] || '0', 10);
        this.rateLimitReset = parseInt(headers['x-ratelimit-reset'] || '0', 10);
        
        if (this.rateLimitRemaining <= 1) {
            const waitTime = (this.rateLimitReset * 1000) - Date.now();
            if (waitTime > 0) {
                outputChannel.appendLine(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    private async handleDownloadError(error: unknown, asset: SherpaAsset): Promise<never> {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`Failed to download asset ${asset.name}: ${errorMessage}`);
        
        if (asset.platform.type === 'gpu') {
            outputChannel.appendLine('GPU binary download failed, attempting CPU fallback...');
            throw new Error('CPU fallback not implemented');
        }
        
        throw new Error(`Asset download failed: ${errorMessage}`);
    }
} 