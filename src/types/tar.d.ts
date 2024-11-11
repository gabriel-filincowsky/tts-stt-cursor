declare module 'tar' {
    interface ExtractOptions {
        cwd?: string;
        sync?: boolean;
        strict?: boolean;
        strip?: number;
    }

    export function extract(options: ExtractOptions): NodeJS.ReadWriteStream;
} 