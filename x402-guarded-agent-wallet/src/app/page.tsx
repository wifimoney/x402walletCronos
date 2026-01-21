"use client";

import { useEffect, useMemo, useState } from "react";
import { createWalletClient, createPublicClient, custom, http, defineChain } from "viem";
import { encodePaymentHeaderClient } from "@/lib/x402-client";
import { ERC20_ABI } from "@/lib/abi/erc20";
import { V2_ROUTER_ABI } from "@/lib/abi/router";
import ConnectBar from "@/components/ConnectBar";

// Define Cronos Testnet chain
const cronosTestnet = defineChain({
  id: 338,
  name: 'Cronos Testnet',
  nativeCurrency: { name: 'Cronos', symbol: 'TCRO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evm-t3.cronos.org'] },
  },
  blockExplorers: {
    default: { name: 'Cronos Explorer', url: 'https://explorer.cronos.org/testnet' },
  },
});

function Tabs({
  tab,
  setTab,
}: {
  tab: "summary" | "trace" | "json";
  setTab: (t: "summary" | "trace" | "json") => void;
}) {
  return (
    <div className="flex gap-2 text-sm p-1 bg-black/20 rounded-lg inline-flex border border-white/5">
      {(["summary", "trace", "json"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${tab === t
            ? "bg-blue-500/20 text-blue-300 border border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
            : "text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent"
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
  const [prompt, setPrompt] = useState("Transfer 10 USDC.e");
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
        account: from,
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

      // Prepare payload
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

      // Backward compatibility: Old intents used tokenIn, new ones use token
      const tokenAddress = (p.token || p.tokenIn) as `0x${string}`;
      const recipientAddress = (p.to || user) as `0x${string}`;
      const transferAmount = p.amount || p.amountIn;

      if (!tokenAddress) {
        throw new Error("Missing token address in intent. Please create a new intent.");
      }

      // Before balance (Token)
      const before = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [user],
      }) as bigint;
      let approveTxHash: `0x${string}` | null = null;
      // Use string[] to allow 'transfer' and other steps without strict literal matching issues
      const workflowPath: string[] = ["preflight", "pay"];
      workflowPath.push("transfer");

      // Transfer
      const amount = BigInt(transferAmount);
      const txHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [
          recipientAddress,
          amount,
        ],
        chain: cronosTestnet,
        account: user,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      // After balance
      const after = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [user],
      }) as bigint;

      const txBase = process.env.NEXT_PUBLIC_EXPLORER_TX_BASE || "";
      const txLink = txBase ? `${txBase}${txHash}` : null;

      // Attach to runReceipt (operational receipts)
      const updated = {
        ...runReceipt,
        execution: {
          txHash: txHash,
          status: "success",
          links: { tx: txLink },
          balanceDeltas: {
            token: (after - before).toString(),
          },
          enforced: {
            amount: transferAmount,
          },
          workflowPath,
          logsSummary: ["Transfer executed successfully"]
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
        balance: runReceipt.preflight?.data?.balance ?? null,
        sufficient: runReceipt.preflight?.data?.sufficient ?? null,
      },
      execution: runReceipt.execution ? {
        txHash: runReceipt.execution.txHash,
        approveTxHash: runReceipt.execution.approveTxHash ?? null,
        links: runReceipt.execution.links,
        balanceDeltas: runReceipt.execution.balanceDeltas,
        enforced: runReceipt.execution.enforced,
        workflowPath: runReceipt.execution.workflowPath,
      } : null,
      dryRun: runReceipt.dryRun,
    }
    : null;

  return (
    <div className="min-h-screen p-6 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-8">

        {/* TOP BAR: Header + Connect */}
        <div className="flex items-center justify-between panel-tech p-4 lg:p-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <span className="text-xl">🛡️</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white text-glow">CronoGuard <span className="text-blue-400 font-light">Control Tower</span></h1>
              <p className="text-xs text-blue-300/60 uppercase tracking-widest font-mono">Agentic Execution Environment</p>
            </div>
          </div>
          <ConnectBar onAccount={setWallet} />
        </div>

        {/* MAIN LAYOUT: 2 Columns */}
        <div className="grid grid-cols-12 gap-6 items-start">

          {/* LEFT COLUMN: Controls + History (4 cols) */}
          <div className="col-span-12 lg:col-span-4 space-y-6">

            {/* 1. Control Panel */}
            <div className="panel-tech p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-blue-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_#3b82f6]"></span>
                  New Action
                </h2>
                <span className="text-[10px] text-gray-500 font-mono border border-gray-800 px-1.5 rounded">v1.0</span>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-medium ml-1">Prompt</label>
                <textarea
                  className="w-full input-tech rounded-lg p-4 text-sm min-h-[100px] font-mono shadow-inner"
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="pt-2">
                <button
                  className={`w-full py-3 rounded-lg text-sm font-bold tracking-wide uppercase transition-all ${loading
                    ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700"
                    : "btn-tech-primary"
                    }`}
                  onClick={() => runPlanAndPreflight()}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin text-lg">⟳</span> Processing...
                    </span>
                  ) : "1. Run Preflight"}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-white/5">
                <label className="flex items-center gap-2 cursor-pointer hover:text-blue-300 transition-colors">
                  <div className={`w-3 h-3 border rounded-sm flex items-center justify-center ${dryRun ? 'bg-blue-500/20 border-blue-500' : 'border-gray-600'}`}>
                    {dryRun && <span className="text-[8px] text-blue-400">✓</span>}
                  </div>
                  <input type="checkbox" className="hidden" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
                  Dry Run Mode
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-red-300 transition-colors">
                  <div className={`w-3 h-3 border rounded-sm flex items-center justify-center ${simulateRpcDown ? 'bg-red-500/20 border-red-500' : 'border-gray-600'}`}>
                    {simulateRpcDown && <span className="text-[8px] text-red-400">✓</span>}
                  </div>
                  <input type="checkbox" className="hidden" checked={simulateRpcDown} onChange={e => setSimulateRpcDown(e.target.checked)} />
                  Simulate Fail
                </label>
              </div>
            </div>

            {/* 2. Runs List */}
            <div className="panel-tech p-0 overflow-hidden flex flex-col max-h-[600px]">
              <div className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center backdrop-blur-md">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">History Log</h2>
                <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-gray-500 font-mono">{runs.length}</span>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
                {runs.length === 0 && (
                  <div className="p-8 text-center flex flex-col items-center gap-2 text-gray-600">
                    <span className="text-2xl opacity-20">📜</span>
                    <span className="text-xs italic">No execution history found</span>
                  </div>
                )}
                {runs.map((r, i) => {
                  const rid = r.intent?.id;
                  const rRisk = r.risk?.score ?? 0;
                  const isActive = rid === runReceipt?.intent?.id;
                  const status = r.execution?.status === 'success' ? 'EXECUTED'
                    : r.payment?.ok ? 'PAID'
                      : r.preflight?.ok ? 'READY'
                        : 'FAILED';

                  // Status Colors
                  const statusColor = status === 'EXECUTED' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                    status === 'FAILED' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                      status === 'PAID' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                        'text-blue-400 bg-blue-500/10 border-blue-500/20';

                  return (
                    <div
                      key={rid || i}
                      onClick={() => setRunReceipt(r)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all group ${isActive
                        ? "bg-white/5 border-blue-500/30 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]"
                        : "bg-transparent border-transparent hover:bg-white/5 hover:border-white/10"
                        }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[9px] px-1.5 py-px rounded border font-mono font-bold tracking-tight ${statusColor}`}>{status}</span>
                        <span className="text-[9px] text-gray-600 font-mono group-hover:text-gray-400 transition-colors">
                          {rid?.slice(0, 8)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-300 line-clamp-1 mb-2 font-medium opacity-90 truncate">
                        {((r.intent as any)?.params?.token) ?
                          `Transfer ${(r.intent as any).params.amount} USDC.e`
                          : "Unknown Intent"}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-1.5 text-[9px] font-bold ${rRisk > 50 ? 'text-red-400' : rRisk > 20 ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                          <div className={`w-1 h-1 rounded-full shadow-[0_0_5px_currentColor] ${rRisk > 50 ? 'bg-red-500' : rRisk > 20 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`} />
                          RISK {rRisk}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Details (8 cols) */}
          <div className="col-span-12 lg:col-span-8 space-y-6">

            {err && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
                <span className="text-xl">⚠️</span>
                <div>
                  <h3 className="text-red-400 font-bold text-sm mb-1">Execution Error</h3>
                  <p className="text-red-200/80 text-xs font-mono">{err}</p>
                </div>
              </div>
            )}

            {runReceipt ? (
              <>
                {/* Action Bar for Selected Run */}
                <div className="panel-tech p-5 flex flex-wrap items-center gap-4 justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0 opacity-20"></div>

                  <div className="flex items-center gap-6">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">Intent ID</div>
                      <div className="text-sm font-mono text-blue-200">{intentId?.slice(0, 12)}...</div>
                    </div>
                    {/* Risk Badge Big */}
                    {runReceipt.risk && (
                      <div className={`px-3 py-1.5 rounded-md border flex flex-col items-center ${runReceipt.risk.score > 50 ? 'bg-red-500/10 border-red-500/30' :
                        runReceipt.risk.score > 20 ? 'bg-amber-500/10 border-amber-500/30' :
                          'bg-emerald-500/10 border-emerald-500/30'
                        }`}>
                        <span className={`text-[9px] font-bold uppercase tracking-wider opacity-70 ${runReceipt.risk.score > 50 ? 'text-red-300' : runReceipt.risk.score > 20 ? 'text-amber-300' : 'text-emerald-300'
                          }`}>Risk Score</span>
                        <span className={`text-lg font-bold leading-none ${runReceipt.risk.score > 50 ? 'text-red-400' : runReceipt.risk.score > 20 ? 'text-amber-400' : 'text-emerald-400 text-glow'
                          }`}>{runReceipt.risk.score}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Step 2: Pay */}
                    <button
                      onClick={payAgentFee}
                      disabled={loading || !canPay || isPaid}
                      className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all flex items-center gap-2 ${isPaid ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default" :
                        canPay ? "btn-tech-outline" :
                          "border-gray-800 text-gray-700 cursor-not-allowed"
                        }`}
                    >
                      {isPaid ? (
                        <><span>Sent</span> <span className="text-lg">✓</span></>
                      ) : loading ? "..." : "2. Pay (x402)"}
                    </button>

                    {/* Step 3: Execute */}
                    <button
                      onClick={executeOnChain}
                      disabled={loading || !canExecute}
                      className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all shadow-lg ${canExecute ? "btn-tech-primary shadow-blue-900/40" :
                        "bg-gray-900 border border-gray-800 text-gray-600 cursor-not-allowed"
                        }`}
                    >
                      {loading ? "Executing..." : "3. Execute Transfer"}
                    </button>
                  </div>
                </div>

                {/* Tabs & Content */}
                <div className="panel-tech p-0 overflow-hidden min-h-[500px] flex flex-col">
                  <div className="border-b border-white/5 bg-black/40 p-3 flex justify-between items-center backdrop-blur-3xl">
                    <Tabs tab={tab} setTab={setTab} />
                    <div className="flex gap-2">
                      <button
                        className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider font-bold flex items-center gap-1"
                        onClick={() => {
                          const r = runReceipt;
                          if (r && r.intent.params.amount) {
                            setPrompt(`Transfer ${r.intent.params.amount} USDC.e`);
                          }
                        }}
                      >
                        <span>Replay</span> <span className="text-lg">↺</span>
                      </button>
                      <button
                        className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider font-bold flex items-center gap-1"
                        onClick={() => {
                          const blob = new Blob([runs.map(r => JSON.stringify(r)).join('\n')], { type: "application/x-ndjson" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `runs-${new Date().toISOString()}.ndjson`;
                          a.click();
                        }}
                      >
                        <span>NDJSON</span> <span className="text-lg">⇲</span>
                      </button>
                      <button
                        className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider font-bold flex items-center gap-1"
                        onClick={() => {
                          const blob = new Blob([runs.map(r => JSON.stringify(r)).join('\n')], { type: "application/x-ndjson" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `runs-${new Date().toISOString()}.ndjson`;
                          a.click();
                        }}
                      >
                        <span>Export NDJSON</span> <span className="text-lg">⇲</span>
                      </button>
                      <button
                        className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider font-bold flex items-center gap-1"
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(runReceipt, null, 2)], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `receipt-${intentId}.json`;
                          a.click();
                        }}
                      >
                        <span>JSON</span> <span className="text-lg">⇩</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-black/20 flex-1 relative">
                    {/* Tech Grid Background overlay for content */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>

                    {tab === "summary" && (
                      <div className="p-6 font-mono text-xs text-blue-100/80 whitespace-pre-wrap overflow-auto max-h-[500px]">
                        {JSON.stringify(summary, null, 2)}
                      </div>
                    )}
                    {tab === "trace" && (
                      <div className="font-mono text-xs divide-y divide-white/5">
                        {runReceipt.trace?.map((t: any, i: number) => (
                          <div key={i} className={`p-4 flex gap-4 items-center group transition-colors ${!t.ok ? "bg-red-500/5" : "hover:bg-white/5"}`}>
                            <span className="text-gray-500 w-24 shrink-0 font-medium opacity-60">
                              {new Date(t.tsUnix * 1000).toLocaleTimeString()}
                            </span>
                            <div className={`w-2 h-2 rounded-full shrink-0 ${t.ok ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-red-500 shadow-[0_0_8px_#ef4444]"}`}></div>
                            <span className={`w-24 shrink-0 font-bold tracking-tight uppercase ${t.ok ? "text-emerald-400" : "text-red-400"}`}>
                              {t.step}
                            </span>
                            <span className="text-gray-300 opacity-90">{t.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {tab === "json" && (
                      <div className="p-6 font-mono text-[10px] leading-relaxed text-gray-400 whitespace-pre-wrap overflow-auto max-h-[500px]">
                        {JSON.stringify(runReceipt, null, 2)}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="panel-tech p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
                <div className="w-24 h-24 rounded-full bg-blue-500/5 border border-blue-500/20 flex items-center justify-center relative">
                  <div className="absolute inset-0 rounded-full animate-ping bg-blue-500/10 delay-1000 duration-3000"></div>
                  <span className="text-4xl filter drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">⚡️</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Ready for Action</h3>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto">Select a run from the history or define a new intent to start the guarded execution flow.</p>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}