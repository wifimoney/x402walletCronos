"use client";

import { useEffect, useMemo, useState } from "react";
import { createWalletClient, createPublicClient, custom, http } from "viem";
import { encodePaymentHeaderClient } from "@/lib/x402-client";
import { ERC20_ABI } from "@/lib/abi/erc20";
import { V2_ROUTER_ABI } from "@/lib/abi/router";
import ConnectBar from "@/components/ConnectBar";

function Tabs({
  tab,
  setTab,
}: {
  tab: "summary" | "trace" | "json";
  setTab: (t: "summary" | "trace" | "json") => void;
}) {
  return (
    <div className="flex gap-2 text-sm">
      {(["summary", "trace", "json"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${tab === t ? "bg-white text-black border-white" : "border-gray-700 text-gray-400 hover:text-white"
            }`}
        >
          {t.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default function Page() {
  // --- 1. Wallet State ---
  const [wallet, setWallet] = useState<{ address: string; chainId: number } | null>(null);

  // --- 2. Run / Input State ---
  const [prompt, setPrompt] = useState("Swap 10 USDC.e to WCRO");
  const [dryRun, setDryRun] = useState(true);
  const [simulateRpcDown, setSimulateRpcDown] = useState(false);

  // The 'active' run logic
  const [runReceipt, setRunReceipt] = useState<any>(null); // The currently viewed/active receipt
  const [payOut, setPayOut] = useState<any>(null); // Payment result for the active run
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // History
  const [runs, setRuns] = useState<any[]>([]);
  const [lastRunPrompt, setLastRunPrompt] = useState("");

  const [tab, setTab] = useState<"summary" | "trace" | "json">("summary");

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem("cronoguard:runs");
    if (saved) {
      try {
        setRuns(JSON.parse(saved));
      } catch { }
    }
  }, []);

  // Save to local storage whenever runs change
  useEffect(() => {
    localStorage.setItem("cronoguard:runs", JSON.stringify(runs));
  }, [runs]);

  // Derived state
  const intentId = runReceipt?.intent?.id;
  const preflightOk = runReceipt?.preflight?.ok;

  // Gating Logic
  const isCorrectNetwork = wallet?.chainId === 338;
  const canPay = !!intentId && !dryRun && preflightOk && !!wallet && isCorrectNetwork;

  // Check if we are PAID or it's a dry run
  const isPaid = !!runReceipt?.payment?.ok;
  // Execution requires: intent, preflight ok, wallet, network, AND (paid OR dryRun)
  const canExecute = !!intentId && preflightOk && !!wallet && isCorrectNetwork && (isPaid || dryRun);


  // --- Actions ---

  async function runPlanAndPreflight(simulateExpired = false) {
    setErr(null);
    setPayOut(null);
    setLoading(true);
    try {
      const body: any = { dryRun, simulateRpcDown, simulateExpired };

      // Resume logic
      if (prompt === lastRunPrompt && runReceipt?.intent && !simulateExpired) {
        body.intent = runReceipt.intent;
      } else {
        body.prompt = prompt;
        setLastRunPrompt(prompt);
      }

      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(JSON.stringify(data));

      const newReceipt = data.runReceipt;
      setRunReceipt(newReceipt);

      // Upsert into runs list (match by intent.id, or prepend new)
      setRuns(prev => {
        const idx = prev.findIndex(r => r.intent?.id === newReceipt.intent?.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = newReceipt;
          return copy;
        }
        return [newReceipt, ...prev].slice(0, 50); // limit 50
      });

    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function payAgentFee() {
    setErr(null);
    if (!canPay) return;

    try {
      setLoading(true);

      // request requirements
      const req = await fetch("/api/pay/requirements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: runReceipt.intent.fee,
          intentId,
        }),
      }).then((r) => r.json());

      if (!req.ok) throw new Error(JSON.stringify(req));

      const walletClient = createWalletClient({ transport: custom(window.ethereum as any) });
      const [from] = await walletClient.requestAddresses();

      const typed = req.typedData;
      typed.message.from = from;

      const signature = await walletClient.signTypedData({
        domain: typed.domain,
        types: typed.types,
        primaryType: typed.primaryType,
        message: typed.message,
      } as any);

      const decodedHeader = {
        x402Version: 1,
        scheme: req.requirements.scheme,
        network: req.requirements.network,
        payload: {
          from,
          to: req.requirements.payTo,
          value: req.requirements.maxAmountRequired,
          validAfter: typed.message.validAfter,
          validBefore: typed.message.validBefore,
          nonce: typed.message.nonce,
          signature,
          asset: req.requirements.asset,
        },
      };

      const paymentHeader = encodePaymentHeaderClient(decodedHeader);

      const settle = await fetch("/api/pay/settle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId,
          paymentHeader,
          paymentRequirements: req.requirements,
        }),
      }).then((r) => r.json());

      if (!settle.ok) throw new Error(settle.error || "Payment failed");

      setPayOut(settle);

      // Auto-refresh the run to get updated receipt with payment
      await runPlanAndPreflight();

    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function executeOnChain() {
    setErr(null);
    if (!canExecute) return;

    setLoading(true);
    try {
      const walletClient = createWalletClient({
        transport: custom(window.ethereum as any),
        chain: undefined as any,
      });
      const [user] = await walletClient.requestAddresses();

      // Prepare deterministic payload (server enforces minOut)
      const prep = await fetch("/api/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intent: runReceipt.intent,
          preflight: runReceipt.preflight,
          userAddress: user,
        }),
      }).then((r) => r.json());

      if (!prep.ok) throw new Error(JSON.stringify(prep));

      const p = prep.payload;
      const rpc = process.env.NEXT_PUBLIC_CRONOS_RPC_URL || "https://evm-t3.cronos.org";
      const publicClient = createPublicClient({ transport: http(rpc) });

      // Before balances
      const beforeIn = await publicClient.readContract({
        address: p.tokenIn,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [user],
      }) as bigint;

      const beforeOut = await publicClient.readContract({
        address: p.tokenOut,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [user],
      }) as bigint;

      // Allowance check
      const allowance = await publicClient.readContract({
        address: p.tokenIn,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [user, p.router],
      }) as bigint;

      let approveTxHash: `0x${string}` | null = null;
      const workflowPath: string[] = ["preflight", "pay"];

      const amountIn = BigInt(p.amountIn);
      if (allowance < amountIn) {
        workflowPath.push("approve");
        approveTxHash = await walletClient.writeContract({
          address: p.tokenIn,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [p.router, amountIn],
          chain: undefined as any,
          account: user,
        });

        await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
      } else {
        workflowPath.push("approve_skipped");
      }

      workflowPath.push("swap");

      // Swap
      const swapTxHash = await walletClient.writeContract({
        address: p.router,
        abi: V2_ROUTER_ABI,
        functionName: "swapExactTokensForTokens",
        args: [
          amountIn,
          BigInt(p.amountOutMin),
          p.path,
          user,
          BigInt(p.deadline),
        ],
        chain: undefined as any,
        account: user,
      });

      await publicClient.waitForTransactionReceipt({ hash: swapTxHash });

      // After balances
      const afterIn = await publicClient.readContract({
        address: p.tokenIn,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [user],
      }) as bigint;

      const afterOut = await publicClient.readContract({
        address: p.tokenOut,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [user],
      }) as bigint;

      const txBase = process.env.NEXT_PUBLIC_EXPLORER_TX_BASE || "";
      const approveLink = approveTxHash && txBase ? `${txBase}${approveTxHash}` : null;
      const swapLink = txBase ? `${txBase}${swapTxHash}` : null;

      // Attach to runReceipt (operational receipts)
      const updated = {
        ...runReceipt,
        execution: {
          txHash: swapTxHash,
          status: "success",
          approveTxHash,
          links: { approve: approveLink, swap: swapLink },
          beforeBalances: {
            tokenIn: beforeIn.toString(),
            tokenOut: beforeOut.toString(),
          },
          afterBalances: {
            tokenIn: afterIn.toString(),
            tokenOut: afterOut.toString(),
          },
          balanceDeltas: {
            tokenIn: (afterIn - beforeIn).toString(),
            tokenOut: (afterOut - beforeOut).toString(),
          },
          enforced: {
            amountOutMin: p.amountOutMin,
            deadline: p.deadline,
            path: p.path,
          },
          workflowPath,
        },
      };

      setRunReceipt(updated);

      // Update history
      setRuns(prev => {
        const idx = prev.findIndex(r => r.intent?.id === updated.intent?.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = updated;
          return copy;
        }
        return [updated, ...prev].slice(0, 50);
      });

    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  // --- View Calculation ---
  const summary = runReceipt
    ? {
      intentId: runReceipt.intent?.id,
      policyAllowed: runReceipt.policy?.allowed,
      preflightOk: runReceipt.preflight?.ok,
      risk: runReceipt.risk,
      quote: {
        expectedOut: runReceipt.preflight?.quote?.expectedOut ?? null,
        minOut: runReceipt.preflight?.quote?.minOut ?? null,
      },
      execution: runReceipt.execution ? {
        txHash: runReceipt.execution.txHash,
        approveTxHash: runReceipt.execution.approveTxHash ?? null,
        links: runReceipt.execution.links,
        beforeBalances: runReceipt.execution.beforeBalances,
        afterBalances: runReceipt.execution.afterBalances,
        enforced: runReceipt.execution.enforced,
        workflowPath: runReceipt.execution.workflowPath,
      } : null,
      dryRun: runReceipt.dryRun,
    }
    : null;

  return (
    <div className="min-h-screen bg-[#111] text-gray-200 p-4">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* TOP BAR: Header + Connect */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">CronoGuard <span className="text-gray-500 font-normal">Control Tower</span></h1>
            <p className="text-xs text-gray-500">Guard Agent Execution (x402) · Preflight → Pay → Execute</p>
          </div>
          <ConnectBar onAccount={setWallet} />
        </div>


        {/* MAIN LAYOUT: 2 Columns */}
        <div className="grid grid-cols-12 gap-6 items-start">

          {/* LEFT COLUMN: Controls + History (4 cols) */}
          <div className="col-span-12 md:col-span-4 space-y-4">

            {/* 1. Control Panel */}
            <div className="panel p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">New Action</h2>

              <div className="space-y-1">
                <label className="text-xs text-gray-500">Prompt</label>
                <textarea
                  className="w-full bg-black/40 border border-gray-800 rounded-lg p-3 text-sm focus:border-blue-500 outline-none transition-colors"
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${loading ? "opacity-50" : "bg-blue-600 border-blue-500 text-white hover:bg-blue-500"
                    }`}
                  onClick={() => runPlanAndPreflight()}
                  disabled={loading}
                >
                  {loading ? "..." : "1. Run Preflight"}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-800">
                <label className="flex items-center gap-2 cursor-pointer hover:text-gray-300">
                  <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
                  Dry Run
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-gray-300">
                  <input type="checkbox" checked={simulateRpcDown} onChange={e => setSimulateRpcDown(e.target.checked)} />
                  Simulate RPC Fail
                </label>
              </div>
            </div>

            {/* 2. Runs List */}
            <div className="panel p-0 overflow-hidden">
              <div className="p-3 border-b border-gray-800 bg-black/20 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">History</h2>
                <span className="text-xs text-gray-600">{runs.length} runs</span>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {runs.length === 0 && (
                  <div className="p-8 text-center text-xs text-gray-600 italic">No runs yet</div>
                )}
                {runs.map((r, i) => {
                  const rid = r.intent?.id;
                  const rRisk = r.risk?.score ?? 0;
                  const isActive = rid === runReceipt?.intent?.id;
                  const status = r.execution?.status === 'success' ? 'EXECUTED'
                    : r.payment?.ok ? 'PAID'
                      : r.preflight?.ok ? 'READY'
                        : 'FAILED';

                  return (
                    <div
                      key={rid || i}
                      onClick={() => setRunReceipt(r)}
                      className={`p-3 border-b border-gray-800 cursor-pointer hover:bg-white/5 transition-colors ${isActive ? "bg-white/5 border-l-2 border-l-blue-500" : "border-l-2 border-l-transparent"}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${status === 'EXECUTED' ? 'bg-green-900/30 text-green-400' :
                            status === 'FAILED' ? 'bg-red-900/30 text-red-400' :
                              'bg-blue-900/30 text-blue-400'
                          }`}>{status}</span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {rid?.slice(0, 8)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-300 line-clamp-2 mb-2 opacity-80">
                        {((r.intent as any)?.params?.tokenIn) ?
                          `Swap ${(r.intent as any).params.amountIn} to ${(r.intent as any).params.tokenOut}`
                          : "Unknown Intent"}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Risk Dot */}
                        <div className={`flex items-center gap-1 text-[10px] ${rRisk > 50 ? 'text-red-400' : rRisk > 20 ? 'text-yellow-400' : 'text-green-400'
                          }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${rRisk > 50 ? 'bg-red-500' : rRisk > 20 ? 'bg-yellow-500' : 'bg-green-500'
                            }`} />
                          Risk {rRisk}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Details (8 cols) */}
          <div className="col-span-12 md:col-span-8 space-y-4">

            {err && (
              <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-xl text-red-200 text-xs font-mono">
                {err}
              </div>
            )}

            {runReceipt ? (
              <>
                {/* Action Bar for Selected Run */}
                <div className="panel p-4 flex flex-wrap items-center gap-4 justify-between bg-black/40">

                  <div className="flex items-center gap-4">
                    <div className="text-sm font-medium text-gray-300">
                      Intent <span className="font-mono text-gray-500">{intentId?.slice(0, 8)}...</span>
                    </div>
                    {/* Risk Badge Big */}
                    {runReceipt.risk && (
                      <div className={`px-2 py-1 rounded text-xs font-bold border ${runReceipt.risk.score > 50 ? 'bg-red-900/20 border-red-800 text-red-400' :
                          runReceipt.risk.score > 20 ? 'bg-yellow-900/20 border-yellow-800 text-yellow-400' :
                            'bg-green-900/20 border-green-800 text-green-400'
                        }`}>
                        RISK SCORE: {runReceipt.risk.score}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Step 2: Pay */}
                    <button
                      onClick={payAgentFee}
                      disabled={loading || !canPay || isPaid}
                      className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${isPaid ? "bg-green-900/20 border-green-800 text-green-400 opacity-50 cursor-default" :
                          canPay ? "bg-black hover:bg-gray-900 border-gray-600 text-white" :
                            "bg-transparent border-gray-800 text-gray-600 cursor-not-allowed"
                        }`}
                    >
                      {loading ? "..." : isPaid ? "2. Paid ✅" : "2. Pay (x402)"}
                    </button>

                    {/* Step 3: Execute */}
                    <button
                      onClick={executeOnChain}
                      disabled={loading || !canExecute}
                      className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${canExecute ? "bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20" :
                          "bg-transparent border-gray-800 text-gray-600 cursor-not-allowed"
                        }`}
                    >
                      {loading ? "Executing..." : "3. Execute Swap"}
                    </button>
                  </div>
                </div>

                {/* Tabs & Content */}
                <div className="panel p-0 overflow-hidden min-h-[400px]">
                  <div className="border-b border-gray-800 bg-black/20 p-3 flex justify-between items-center">
                    <Tabs tab={tab} setTab={setTab} />
                    <button
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(runReceipt, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `receipt-${intentId || "unknown"}.json`;
                        a.click();
                      }}
                    >
                      Download JSON
                    </button>
                  </div>

                  <div className="p-0">
                    {tab === "summary" && (
                      <div className="p-4 font-mono text-xs text-gray-300 whitespace-pre-wrap overflow-auto max-h-[500px]">
                        {JSON.stringify(summary, null, 2)}
                      </div>
                    )}
                    {tab === "trace" && (
                      <div className="font-mono text-xs">
                        {runReceipt.trace?.map((t: any, i: number) => (
                          <div key={i} className={`p-2 border-b border-gray-800/50 flex gap-3 ${!t.ok ? "bg-red-900/10" : "hover:bg-white/5"
                            }`}>
                            <span className="text-gray-600 w-24 shrink-0">
                              {new Date(t.tsUnix * 1000).toLocaleTimeString()}
                            </span>
                            <span className={`w-20 shrink-0 font-bold ${t.ok ? "text-green-500" : "text-red-500"}`}>
                              {t.step.toUpperCase()}
                            </span>
                            <span className="text-gray-300">{t.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {tab === "json" && (
                      <div className="p-4 font-mono text-xs text-gray-400 whitespace-pre-wrap overflow-auto max-h-[500px]">
                        {JSON.stringify(runReceipt, null, 2)}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="panel p-12 flex flex-col items-center justify-center text-gray-600 space-y-4">
                <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center text-2xl">
                  ⚡️
                </div>
                <p>Select a run or create a new one to see details.</p>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}