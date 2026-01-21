"use client";

import { useMemo, useState } from "react";
import { createWalletClient, createPublicClient, custom, http } from "viem";
import { encodePaymentHeaderClient } from "@/lib/x402-client";
import { ERC20_ABI } from "@/lib/abi/erc20";
import { V2_ROUTER_ABI } from "@/lib/abi/router";

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
          className={`px-3 py-1 rounded border ${tab === t ? "bg-black text-white" : ""
            }`}
        >
          {t.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default function Page() {
  const [prompt, setPrompt] = useState("Swap 10 USDC.e to WCRO");
  const [dryRun, setDryRun] = useState(true);
  const [simulateRpcDown, setSimulateRpcDown] = useState(false);
  const [loading, setLoading] = useState(false);

  const [lastRunPrompt, setLastRunPrompt] = useState("");

  const [runReceipt, setRunReceipt] = useState<any>(null);
  const [payOut, setPayOut] = useState<any>(null);
  const [tab, setTab] = useState<"summary" | "trace" | "json">("summary");
  const [err, setErr] = useState<string | null>(null);

  const intentId = runReceipt?.intent?.id;

  // Preflight Gate: Block payment if preflight failed
  const preflightOk = runReceipt?.preflight?.ok;
  const canPay = useMemo(() => !!intentId && !dryRun && preflightOk, [intentId, dryRun, preflightOk]);

  async function run(simulateExpired = false) {
    setErr(null);
    setPayOut(null);
    setLoading(true);
    try {
      const body: any = { dryRun, simulateRpcDown, simulateExpired };

      // If prompt hasn't changed and we have an intent, try to resume/execute it
      // This is critical for the "Pay -> Run (Real)" flow
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
      setRunReceipt(data.runReceipt);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function payAgentFee() {
    setErr(null);
    setPayOut(null);

    if (!intentId) return setErr("Run first to generate intentId.");
    if (!preflightOk) return setErr("Preflight checks must pass before payment.");
    if (!window.ethereum) return setErr("No injected wallet found (MetaMask/Rabby).");

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

      const wallet = createWalletClient({ transport: custom(window.ethereum as any) });
      const [from] = await wallet.requestAddresses();

      const typed = req.typedData;
      typed.message.from = from;

      const signature = await wallet.signTypedData({
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

      setPayOut(settle);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function executeOnChain() {
    setErr(null);
    if (!window.ethereum) return setErr("No injected wallet found.");

    if (!runReceipt?.intent || !runReceipt?.preflight) {
      return setErr("Run first so intent + preflight exist.");
    }

    // Ensure preflight passed
    if (!runReceipt.preflight.ok) {
      return setErr("Preflight failed. Cannot execute.");
    }

    setLoading(true);
    try {
      const wallet = createWalletClient({
        transport: custom(window.ethereum as any),
        chain: undefined as any,
      });
      const [user] = await wallet.requestAddresses();

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

      const p = prep.payload as {
        router: `0x${string}`;
        tokenIn: `0x${string}`;
        tokenOut: `0x${string}`;
        amountIn: string;
        amountOutMin: string;
        path: `0x${string}`[];
        to: `0x${string}`;
        deadline: number;
        intentId: string;
      };

      const rpc = process.env.NEXT_PUBLIC_CRONOS_RPC_URL || runReceipt.intent?.chain?.rpcUrl || "https://evm-t3.cronos.org";
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
        approveTxHash = await wallet.writeContract({
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
      const swapTxHash = await wallet.writeContract({
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
          workflowPath, // Added workflowPath
        },
      };

      setRunReceipt(updated);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const summary = runReceipt
    ? {
      intentId: runReceipt.intent?.id,
      policyAllowed: runReceipt.policy?.allowed,
      preflightOk: runReceipt.preflight?.ok,
      risk: runReceipt.risk, // Added Risk
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
        workflowPath: runReceipt.execution.workflowPath, // Added to summary
      } : null,
      dryRun: runReceipt.dryRun,
    }
    : null;

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">x402 Guarded Agent Wallet</h1>
        <p className="text-sm opacity-80">
          Operational flow: Run → (optional Pay) → Run again (real mode gate)
        </p>
      </header>

      <section className="space-y-2">
        <label className="text-sm font-medium">Prompt</label>
        <textarea
          className="w-full border rounded p-3 min-h-[90px]"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
        />
        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
            onClick={() => run()}
            disabled={loading}
          >
            {loading ? "Running..." : "Run (Plan→Preflight→Execute)"}
          </button>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={loading}
            />
            Dry-run only (no payment)
          </label>

          <button
            className="px-4 py-2 rounded border disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
            onClick={payAgentFee}
            disabled={loading || !canPay}
            title={
              !preflightOk
                ? "Preflight check failed. Cannot pay."
                : dryRun
                  ? "Disable dry-run to enable payment"
                  : "Pay agent fee via x402"
            }
          >
            Pay agent fee (x402)
          </button>

          <button
            className="px-4 py-2 rounded border disabled:opacity-50"
            disabled={loading || dryRun}
            onClick={executeOnChain}
            title={dryRun ? "Disable dry-run to enable real execution" : "Client-signed approve+swap"}
          >
            Execute swap (client-signed)
          </button>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="simulateRpcDown"
              checked={simulateRpcDown}
              onChange={(e) => setSimulateRpcDown(e.target.checked)}
              disabled={loading}
            />
            <label htmlFor="simulateRpcDown" className="text-xs text-gray-500">Simulate RPC Down</label>
          </div>

          <button
            className="text-xs text-gray-500 underline"
            onClick={() => {
              // Forced expired run
              run(true);
            }}
            disabled={loading}
            title="Sets usage deadline to past"
          >
            Simulate Expired Intent (Dev)
          </button>

          {/* Download Receipt Button */}
          {runReceipt && (
            <button
              className="text-xs text-blue-600 underline ml-4"
              onClick={() => {
                const blob = new Blob([JSON.stringify(runReceipt, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `receipt-${intentId || "unknown"}.json`;
                a.click();
              }}
            >
              Download Receipt (JSON)
            </button>
          )}
        </div>
      </section>


      {err && (
        <pre className="p-3 bg-red-50 border border-red-200 rounded text-xs overflow-auto">
          {err}
        </pre>
      )}

      {runReceipt && (
        <section className="border rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold">
                RunReceipt (intentId: <span className="font-mono">{intentId}</span>)
              </div>
              {/* Risk Badge */}
              {runReceipt.risk && (
                <div className={`text-xs px-2 py-0.5 rounded border ${runReceipt.risk.score > 50 ? 'bg-red-100 border-red-300 text-red-800' :
                  runReceipt.risk.score > 20 ? 'bg-yellow-100 border-yellow-300 text-yellow-800' :
                    'bg-green-100 border-green-300 text-green-800'
                  }`}>
                  Risk: {runReceipt.risk.score}/100
                </div>
              )}
            </div>
            <Tabs tab={tab} setTab={setTab} />
          </div>

          {tab === "summary" && (
            <pre className="text-xs overflow-auto bg-black text-white border rounded p-3">
              {JSON.stringify(summary, null, 2)}
            </pre>
          )}

          {tab === "trace" && (
            <pre className="text-xs overflow-auto bg-black text-white border rounded p-3">
              {JSON.stringify(runReceipt.trace, null, 2)}
            </pre>
          )}

          {tab === "json" && (
            <pre className="text-xs overflow-auto bg-black text-white border rounded p-3">
              {JSON.stringify(runReceipt, null, 2)}
            </pre>
          )}
        </section>
      )}

      {payOut && (
        <section className="border rounded p-4">
          <div className="text-sm font-semibold mb-2">Pay result</div>
          <pre className="text-xs overflow-auto bg-black text-white border rounded p-3">
            {JSON.stringify(payOut, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}