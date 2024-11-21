export class InitStateManager {
    private static instance: InitStateManager;
    private state: {
        versionValidated: boolean;
        binariesInstalled: boolean;
        modelsValidated: boolean;
        gpuInitialized: boolean;
        versionState: {
            currentVersion: string;
            targetVersion: string;
            lastCheck: string;
        };
    } = {
        versionValidated: false,
        binariesInstalled: false,
        modelsValidated: false,
        gpuInitialized: false,
        versionState: {
            currentVersion: '0.0.0',
            targetVersion: '0.0.0',
            lastCheck: new Date().toISOString()
        }
    };

    private constructor() {}

    static getInstance(): InitStateManager {
        if (!this.instance) {
            this.instance = new InitStateManager();
        }
        return this.instance;
    }

    setVersionValidated(value: boolean): void {
        this.state.versionValidated = value;
    }

    setBinariesInstalled(value: boolean): void {
        this.state.binariesInstalled = value;
    }

    setModelsValidated(value: boolean): void {
        this.state.modelsValidated = value;
    }

    setGPUInitialized(value: boolean): void {
        this.state.gpuInitialized = value;
    }

    getState(): Readonly<typeof this.state> {
        return { ...this.state };
    }

    isFullyInitialized(): boolean {
        return Object.values(this.state).every(value => value);
    }

    reset(): void {
        this.state = {
            versionValidated: false,
            binariesInstalled: false,
            modelsValidated: false,
            gpuInitialized: false,
            versionState: {
                currentVersion: '0.0.0',
                targetVersion: '0.0.0',
                lastCheck: new Date().toISOString()
            }
        };
    }

    async updateVersionState(version: string): Promise<void> {
        this.state.versionState = {
            currentVersion: version,
            targetVersion: version,
            lastCheck: new Date().toISOString()
        };
        this.setVersionValidated(true);
    }

    getVersionState(): Readonly<typeof this.state.versionState> {
        return { ...this.state.versionState };
    }
} 