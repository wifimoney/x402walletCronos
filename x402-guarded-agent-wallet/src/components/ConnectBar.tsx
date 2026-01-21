"use client";

import { useEffect, useMemo, useState } from "react";

const CRONOS_TESTNET = {
    chainIdHex: "0x152", // 338
    chainIdDec: 338,
    chainName: "Cronos Testnet",
    nativeCurrency: { name: "tCRO", symbol: "tCRO", decimals: 18 },
    rpcUrls: ["https://evm-t3.cronos.org"],
    blockExplorerUrls: ["https://explorer.cronos.org/testnet/"],
};

function shortAddr(a?: string) {
    if (!a) return "";
    return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function ConnectBar({
    onAccount,
}: {
    onAccount?: (acct: { address: string; chainId: number } | null) => void;
}) {
    const [address, setAddress] = useState<string>("");
    const [chainId, setChainId] = useState<number | null>(null);
    const [err, setErr] = useState<string>("");

    const isReady = useMemo(() => typeof window !== "undefined" && !!window.ethereum, []);
    const isCronosTestnet = chainId === CRONOS_TESTNET.chainIdDec;

    async function refresh() {
        if (!window.ethereum) return;
        try {
            const accounts: string[] = await window.ethereum.request({ method: "eth_accounts" });
            const cidHex: string = await window.ethereum.request({ method: "eth_chainId" });
            const cid = parseInt(cidHex, 16);

            setAddress(accounts?.[0] ?? "");
            setChainId(cid);
            setErr("");

            if (accounts?.[0]) {
                onAccount?.({ address: accounts[0], chainId: cid });
            } else {
                onAccount?.(null);
            }
        } catch (e: any) {
            setErr(e?.message ?? String(e));
        }
    }

    async function connect() {
        if (!window.ethereum) return setErr("No injected wallet found (MetaMask/Crypto.com wallet extension).");
        try {
            const accounts: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
            setAddress(accounts?.[0] ?? "");
            await refresh();
        } catch (e: any) {
            setErr(e?.message ?? String(e));
        }
    }

    async function switchToCronosTestnet() {
        if (!window.ethereum) return;
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: CRONOS_TESTNET.chainIdHex }],
            });
            await refresh();
        } catch (e: any) {
            // 4902 = unknown chain
            if (e?.code === 4902) {
                const params: any[] = [CRONOS_TESTNET];
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params,
                });
                await refresh();
            } else {
                setErr(e?.message ?? String(e));
            }
        }
    }

    useEffect(() => {
        refresh();
        const eth = window.ethereum;
        if (!eth?.on) return;

        const onAccounts = () => refresh();
        const onChain = () => refresh();

        eth.on("accountsChanged", onAccounts);
        eth.on("chainChanged", onChain);

        return () => {
            eth.removeListener?.("accountsChanged", onAccounts);
            eth.removeListener?.("chainChanged", onChain);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="flex items-center gap-4 bg-black/40 border border-white/5 px-4 py-2 rounded-lg backdrop-blur-sm">
            <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-0.5">Wallet Status</div>
                <div className="text-xs font-mono">
                    {address ? (
                        <div className="flex items-center gap-2">
                            <span className="text-blue-200">{shortAddr(address)}</span>
                            <span className="text-gray-600">|</span>
                            <span className={`flex items-center gap-1.5 ${isCronosTestnet ? "text-emerald-400" : "text-amber-400"}`}>
                                Chain {chainId} {isCronosTestnet ? (
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_#10b981]"></span>
                                ) : (
                                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse shadow-[0_0_5px_#f59e0b]"></span>
                                )}
                            </span>
                        </div>
                    ) : (
                        <span className="text-gray-500 italic">Not connected</span>
                    )}
                </div>
                {err && <div className="text-red-400 text-[10px] mt-1 truncate max-w-[200px]">{err}</div>}
            </div>

            <div className="flex gap-2">
                {!address ? (
                    <button onClick={connect} className="px-4 py-1.5 rounded border border-white/20 hover:border-blue-400 hover:bg-blue-500/10 hover:text-blue-300 text-xs font-bold uppercase tracking-wide transition-all">
                        Connect
                    </button>
                ) : (
                    <button onClick={refresh} className="p-1.5 rounded border border-white/10 hover:bg-white/5 text-gray-500 hover:text-white transition-colors" title="Refresh">
                        <span className="text-xs">⟳</span>
                    </button>
                )}

                <button
                    onClick={switchToCronosTestnet}
                    disabled={!address || isCronosTestnet}
                    className={`px-3 py-1.5 rounded border text-[10px] uppercase font-bold tracking-wide transition-all ${!address || isCronosTestnet
                            ? "border-transparent text-gray-700 cursor-not-allowed"
                            : "border-amber-500/50 text-amber-500 hover:bg-amber-500/10 hover:border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                        }`}
                >
                    {isCronosTestnet ? "Testnet Active" : "Switch Network"}
                </button>
            </div>
        </div>
    );
}
