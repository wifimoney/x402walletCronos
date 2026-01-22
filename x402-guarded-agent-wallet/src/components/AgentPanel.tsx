"use client";

import { useState } from "react";
import { Wallet, Activity, FileSearch, Copy, Check, Loader2 } from "lucide-react";

interface AgentPanelProps {
    walletAddress?: string;
}

type QueryResult = {
    ok: boolean;
    action?: string;
    result?: any;
    error?: string;
};

export function AgentPanel({ walletAddress }: AgentPanelProps) {
    const [loading, setLoading] = useState<string | null>(null);
    const [result, setResult] = useState<QueryResult | null>(null);
    const [txHashInput, setTxHashInput] = useState("");
    const [copied, setCopied] = useState(false);

    async function runQuery(action: string, extra?: Record<string, string>) {
        setLoading(action);
        setResult(null);

        try {
            const res = await fetch("/api/agent/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, walletAddress, ...extra }),
            });
            const data = await res.json();
            setResult(data);
        } catch (err: any) {
            setResult({ ok: false, error: err.message });
        } finally {
            setLoading(null);
        }
    }

    function copyResult() {
        if (!result?.result) return;
        navigator.clipboard.writeText(JSON.stringify(result.result, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="panel-tech p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                <div className="w-8 h-8 rounded-lg bg-[#002D74] flex items-center justify-center p-1">
                    <img src="/crypto-logo.png" alt="Crypto.com" className="w-6 h-6 object-contain" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white">Crypto.com Agent Tools</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">AI SDK Integration</p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
                <button
                    onClick={() => runQuery("analyze_wallet")}
                    disabled={!walletAddress || loading === "analyze_wallet"}
                    className="w-full px-3 py-2.5 text-left text-sm bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 hover:from-emerald-500/20 hover:to-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 font-medium transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading === "analyze_wallet" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Wallet className="w-4 h-4" />
                    )}
                    <div>
                        <div>Analyze Wallet</div>
                        <div className="text-[10px] text-emerald-500/60">Balances, tx count, activity</div>
                    </div>
                </button>

                <button
                    onClick={() => runQuery("network_status")}
                    disabled={loading === "network_status"}
                    className="w-full px-3 py-2.5 text-left text-sm bg-gradient-to-r from-blue-500/10 to-blue-500/5 hover:from-blue-500/20 hover:to-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 font-medium transition-all flex items-center gap-3 disabled:opacity-50"
                >
                    {loading === "network_status" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Activity className="w-4 h-4" />
                    )}
                    <div>
                        <div>Network Status</div>
                        <div className="text-[10px] text-blue-500/60">Block height, gas, health</div>
                    </div>
                </button>

                <div className="relative">
                    <input
                        type="text"
                        placeholder="Paste tx hash..."
                        value={txHashInput}
                        onChange={(e) => setTxHashInput(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-black/30 border border-white/10 rounded-lg text-gray-300 placeholder-gray-600 focus:border-amber-500/50 focus:outline-none font-mono"
                    />
                    <button
                        onClick={() => runQuery("explain_tx", { txHash: txHashInput })}
                        disabled={!txHashInput || loading === "explain_tx"}
                        className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded text-amber-400 font-bold transition-all disabled:opacity-50 flex items-center gap-1"
                    >
                        {loading === "explain_tx" ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <FileSearch className="w-3 h-3" />
                        )}
                        Explain
                    </button>
                </div>
            </div>

            {/* Result Display */}
            {result && (
                <div className={`rounded-lg border p-3 space-y-2 animate-in fade-in slide-in-from-top-2 ${result.ok
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-red-500/5 border-red-500/20"
                    }`}>
                    <div className="flex justify-between items-start">
                        <span className={`text-[10px] font-bold uppercase ${result.ok ? "text-emerald-400" : "text-red-400"
                            }`}>
                            {result.ok ? `✓ ${result.action?.replace("_", " ")}` : "✗ Error"}
                        </span>
                        {result.ok && (
                            <button
                                onClick={copyResult}
                                className="text-gray-500 hover:text-gray-300 transition-colors"
                                title="Copy result"
                            >
                                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                        )}
                    </div>

                    {result.ok && result.result?.summary && (
                        <p className="text-xs text-gray-300 leading-relaxed">
                            {result.result.summary}
                        </p>
                    )}

                    {!result.ok && (
                        <p className="text-xs text-red-300">{result.error}</p>
                    )}

                    {result.ok && (
                        <details className="text-[10px]">
                            <summary className="text-gray-500 cursor-pointer hover:text-gray-400">
                                Raw JSON
                            </summary>
                            <pre className="mt-2 p-2 bg-black/30 rounded text-gray-400 overflow-auto max-h-32 font-mono">
                                {JSON.stringify(result.result, null, 2)}
                            </pre>
                        </details>
                    )}
                </div>
            )}

            {!walletAddress && (
                <p className="text-[10px] text-gray-600 italic text-center">
                    Connect wallet to enable wallet analysis
                </p>
            )}
        </div>
    );
}
