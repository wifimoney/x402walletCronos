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
        <div className="flex items-center justify-between p-3 border border-gray-800 rounded-xl bg-black/40">
            <div>
                <div className="font-bold text-sm">Wallet</div>
                <div className="opacity-80 text-xs">
                    {address ? (
                        <span className="flex items-center gap-1">
                            {shortAddr(address)} · Chain {chainId} {isCronosTestnet ? "✅" : "⚠️"}
                        </span>
                    ) : (
                        "Not connected"
                    )}
                </div>
                {err && <div className="text-red-400 text-xs mt-1">{err}</div>}
            </div>

            <div className="flex gap-2">
                {!address ? (
                    <button onClick={connect} className="px-3 py-2 rounded-lg border border-gray-700 hover:bg-white/10 text-xs">
                        Connect
                    </button>
                ) : (
                    <button onClick={refresh} className="px-3 py-2 rounded-lg border border-gray-700 hover:bg-white/10 text-xs">
                        Refresh
                    </button>
                )}

                <button
                    onClick={switchToCronosTestnet}
                    disabled={!address || isCronosTestnet}
                    className={`px-3 py-2 rounded-lg border border-gray-700 text-xs ${!address || isCronosTestnet ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10"}`}
                >
                    Switch to Testnet
                </button>
            </div>
        </div>
    );
}
