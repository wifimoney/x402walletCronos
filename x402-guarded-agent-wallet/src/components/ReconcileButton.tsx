"use client";

import { useState } from "react";
import { createPublicClient, http } from "viem";
import { defineChain } from "viem";

const cronosTestnet = defineChain({
    id: 338,
    name: 'Cronos Testnet',
    nativeCurrency: { name: 'Cronos', symbol: 'TCRO', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://evm-t3.cronos.org'] },
    },
});

interface ReconcileButtonProps {
    runs: any[];
    setRuns: (updated: any[]) => void;
}

export default function ReconcileButton({ runs, setRuns }: ReconcileButtonProps) {
    const [reconciling, setReconciling] = useState(false);
    const [report, setReport] = useState<string | null>(null);

    const reconcile = async () => {
        setReconciling(true);
        setReport(null);
        try {
            const publicClient = createPublicClient({
                chain: cronosTestnet,
                transport: http()
            });

            let fixedCount = 0;
            const updatedRuns = await Promise.all(runs.map(async (r) => {
                // Only check runs that are marked 'success' but we want to be sure, or 'pending'
                const txHash = r.execution?.txHash;

                if (!txHash || r.execution?.status === 'reverted' || r.execution?.status === 'failed') {
                    return r;
                }

                try {
                    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
                    const actualStatus = receipt.status === "success" ? "success" : "reverted";

                    if (r.execution.status !== actualStatus) {
                        fixedCount++;
                        return {
                            ...r,
                            execution: {
                                ...r.execution,
                                status: actualStatus,
                                logsSummary: [...(r.execution.logsSummary || []), `[RECONCILED] Status updated to ${actualStatus} based on chain truth.`]
                            }
                        };
                    }
                } catch (e) {
                    // Receipt might not exist yet if very fresh
                }
                return r;
            }));

            setRuns(updatedRuns);
            setReport(`Reconciled ${runs.length} runs. Fixed ${fixedCount} mismatches.`);
            setTimeout(() => setReport(null), 5000);
        } catch (e: any) {
            setReport(`Error: ${e.message}`);
        } finally {
            setReconciling(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={reconcile}
                disabled={reconciling}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white hover:border-gray-500 transition-all flex items-center gap-2"
                title="Re-check all transaction statuses against the blockchain"
            >
                <span className={reconciling ? "animate-spin" : ""}>🔄</span>
                {reconciling ? "Reconciling..." : "Reconcile History"}
            </button>
            {report && (
                <span className="text-[10px] text-emerald-400 animate-in fade-in slide-in-from-left-2 transition-all">
                    {report}
                </span>
            )}
        </div>
    );
}
