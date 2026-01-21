
export { };

declare global {
    interface Window {
        ethereum?: {
            isMetaMask?: boolean;
            request: (args: { method: string; params?: unknown[] | object }) => Promise<any>;
            on?: (event: string, cb: (...args: any[]) => void) => void;
            removeListener?: (event: string, cb: (...args: any[]) => void) => void;
        };
    }
}
