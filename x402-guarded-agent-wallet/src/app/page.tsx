"use client";

import { useMemo, useState } from "react";
import { createWalletClient, custom } from "viem";
import { encodePaymentHeaderClient } from "@/lib/x402-client";

export default function Page() {
  const [prompt, setPrompt] = useState("Swap 10 USDC.e to CRO");
  const [intent, setIntent] = useState<any>(null);
  const [policy, setPolicy] = useState<any>(null);
  const [preflight, setPreflight] = useState<any>(null);
  const [runReceipt, setRunReceipt] = useState<any>(null);
  const [dryRun, setDryRun] = useState(true);
  const [payOut, setPayOut] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const canExecute = useMemo(() => !!intent, [intent]);

  async function plan() {
    setErr(null);
    setRunReceipt(null);
    setPayOut(null);

    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setErr(JSON.stringify(data));
      return;
    }
    setIntent(data.intent);
    setPolicy(null);
    setPreflight(null);
  }

  async function doPreflight() {
    setErr(null);
    setRunReceipt(null);
    const res = await fetch("/api/preflight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intent, dryRun }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setErr(JSON.stringify(data));
      return;
    }
    setPolicy(data.policy);
    setPreflight(data.preflight);
  }

  async function execute() {
    setErr(null);
    const res = await fetch("/api/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intent, dryRun }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setErr(JSON.stringify(data));
      return;
    }
    setRunReceipt(data.runReceipt);
  }

  async function payAgentFee() {
    setErr(null);
    setPayOut(null);

    if (!window.ethereum) {
      setErr("No injected wallet found (MetaMask/Rabby). Use Dry-run for now.");
      return;
    }

    // requirements
    const req = await fetch("/api/pay/requirements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: intent.fee }),
    }).then((r) => r.json());

    if (!req.ok) {
      setErr(JSON.stringify(req));
      return;
    }

    // wallet
    const wallet = createWalletClient({ transport: custom(window.ethereum as any) });
    const [from] = await wallet.requestAddresses();

    // sign typed data (EIP-3009)
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

    // settle
    const settle = await fetch("/api/pay/settle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paymentHeader,
        paymentRequirements: req.requirements,
      }),
    }).then((r) => r.json());

    setPayOut(settle);
  }

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">x402 Guarded Agent Wallet</h1>
        <p className="text-sm opacity-80">
          P3: plan → policy/preflight → (optional pay) → execute → receipts
        </p>
      </header>

      <section className="space-y-2">
        <label className="text-sm font-medium">Prompt</label>
        <textarea
          className="w-full border rounded p-3 min-h-[90px]"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded bg-black text-white" onClick={plan}>
            Plan
          </button>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Dry-run only (no payment)
          </label>

          <button
            className="px-4 py-2 rounded border"
            disabled={!intent}
            onClick={doPreflight}
          >
            Preflight
          </button>

          <button
            className="px-4 py-2 rounded border"
            disabled={!canExecute}
            onClick={execute}
          >
            Execute
          </button>

          <button
            className="px-4 py-2 rounded border"
            disabled={!intent || dryRun}
            onClick={payAgentFee}
            title={dryRun ? "Disable dry-run to enable payment" : "Pay agent fee via x402"}
          >
            Pay agent fee (x402)
          </button>
        </div>
      </section>

      {err && (
        <pre className="p-3 bg-red-50 border border-red-200 rounded text-xs overflow-auto">
          {err}
        </pre>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-3">
          <div className="text-sm font-semibold mb-2">Intent</div>
          <pre className="text-xs overflow-auto">{JSON.stringify(intent, null, 2)}</pre>
        </div>

        <div className="border rounded p-3">
          <div className="text-sm font-semibold mb-2">Policy</div>
          <pre className="text-xs overflow-auto">{JSON.stringify(policy, null, 2)}</pre>
        </div>

        <div className="border rounded p-3">
          <div className="text-sm font-semibold mb-2">Preflight</div>
          <pre className="text-xs overflow-auto">{JSON.stringify(preflight, null, 2)}</pre>
        </div>

        <div className="border rounded p-3">
          <div className="text-sm font-semibold mb-2">Pay result</div>
          <pre className="text-xs overflow-auto">{JSON.stringify(payOut, null, 2)}</pre>
        </div>
      </section>

      <section className="border rounded p-3">
        <div className="text-sm font-semibold mb-2">RunReceipt (what judges see)</div>
        <pre className="text-xs overflow-auto">{JSON.stringify(runReceipt, null, 2)}</pre>
      </section>
    </main>
  );
}