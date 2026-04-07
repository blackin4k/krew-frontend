interface Window {
    electronAPI: {
        toggleFullscreen: () => Promise<void>;
        setSystemVolume: (volume: number) => Promise<void>;
        getSystemVolume: () => Promise<number>;
    };
}
