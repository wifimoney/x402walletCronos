"use client";

import { useState } from "react";
import { createWalletClient, custom } from "viem";
import { encodePaymentHeaderClient } from "@/lib/x402-client";

export default function Page() {
  const [intent, setIntent] = useState<any>(null);
  const [preflight, setPreflight] = useState<any>(null);
  const [payRes, setPayRes] = useState<any>(null);

  async function demoIntent() {
    // TEMP: you’ll replace this with /api/plan output next phase
    const mock = {
      action: "swap",
      params: {
        tokenIn: "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0",
        tokenOut: "0x0000000000000000000000000000000000000000",
        amountIn: "10000000", // 10 USDC.e (6 decimals)
        maxSlippageBps: 50,
        deadline: Math.floor(Date.now() / 1000) + 600,
      },
      fee: "1000000", // 1 USDC.e
      sessionExpiry: Math.floor(Date.now() / 1000) + 60,
    };
    setIntent(mock);
    setPreflight(null);
    setPayRes(null);
  }

  async function runPreflight() {
    const r = await fetch("/api/preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent }),
    });
    setPreflight(await r.json());
  }

  async function payOnly() {
    if (!window.ethereum) throw new Error("No injected wallet found (MetaMask etc).");

    // 1) get requirements + typed data
    const req = await fetch("/api/pay/requirements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: intent.fee }),
    }).then((r) => r.json());

    if (!req.ok) throw new Error(JSON.stringify(req));

    // 2) get wallet address
    const wallet = createWalletClient({ transport: custom(window.ethereum as any) });
    const [from] = await wallet.requestAddresses();

    // 3) sign typed data (one-time, expires)
    const typed = req.typedData;
    typed.message.from = from;

    const signature = await wallet.signTypedData({
      domain: typed.domain,
      types: typed.types,
      primaryType: typed.primaryType,
      message: typed.message,
    } as any);

    // 4) build payment header (base64)
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

    const paymentHeader = encodePaymentHeaderClient(decodedHeader as any);

    // 5) server verify + settle
    const settle = await fetch("/api/pay/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentHeader,
        paymentRequirements: req.requirements,
      }),
    }).then((r) => r.json());

    setPayRes(settle);
  }

  return (
    <main style={{ padding: 24, fontFamily: "ui-sans-serif" }}>
      <h1>x402 Guarded Agent Wallet — P2</h1>

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button onClick={demoIntent}>Set mock intent</button>
        <button disabled={!intent} onClick={runPreflight}>Run preflight</button>
        <button disabled={!intent} onClick={payOnly}>Pay agent fee (x402)</button>
      </div>

      <pre style={{ marginTop: 16, background: "#111", color: "#ddd", padding: 12, overflow: "auto" }}>
        intent: {JSON.stringify(intent, null, 2)}
      </pre>

      <pre style={{ marginTop: 16, background: "#111", color: "#ddd", padding: 12, overflow: "auto" }}>
        preflight: {JSON.stringify(preflight, null, 2)}
      </pre>

      <pre style={{ marginTop: 16, background: "#111", color: "#ddd", padding: 12, overflow: "auto" }}>
        pay: {JSON.stringify(payRes, null, 2)}
      </pre>
    </main>
  );
}