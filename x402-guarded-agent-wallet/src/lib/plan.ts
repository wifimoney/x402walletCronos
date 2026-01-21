import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { CRONOS_NETWORK, USDC_E, SELLER_ADDRESS, CHAIN_ID } from "./constants";
import type { ActionIntent } from "./types";

function toBaseUnits(amount: number, decimals: number) {
  // Avoid float issues for simple inputs: support up to 6 decimals here.
  const s = amount.toFixed(decimals);
  const [a, b] = s.split(".");
  return a + (b ?? "").padEnd(decimals, "0");
}

function generateIdempotencyKey(params: { token: string; to: string; amount: string }, seller: string, chainId: number): string {
  const payload = JSON.stringify({ params, seller, chainId });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function buildIntent(opts: {
  prompt: string;
  recipient: `0x${string}`;
}): ActionIntent {
  const now = Math.floor(Date.now() / 1000);

  // MVP parse: "Transfer 10 USDC.e"
  // Extract first number; fallback to 10.
  const m = opts.prompt.match(/(\d+(\.\d+)?)/);
  const amountVal = m ? Number(m[1]) : 10;

  // USDC.e is 6 decimals
  const amount = toBaseUnits(amountVal, 6);

  const token = USDC_E[CRONOS_NETWORK];

  // Default to SELLER_ADDRESS for demo reliability (avoids DENY_recipient_zero policy).
  // In a real app, recipient comes from prompt or state.
  const to = opts.recipient && opts.recipient !== ("0x" + "0".repeat(40))
    ? opts.recipient
    : SELLER_ADDRESS; // Default to seller/operator address for demo

  const fee = toBaseUnits(1, 6); // 1 USDC.e agent fee
  const requiredTotal = (BigInt(amount) + BigInt(fee)).toString();

  const params = { token, to, amount };
  const idempotencyKey = generateIdempotencyKey(params, SELLER_ADDRESS, CHAIN_ID[CRONOS_NETWORK]);

  return {
    id: nanoid(10),
    idempotencyKey,
    createdAt: now,
    action: "transfer",
    params,
    fee,
    requiredTotal,
    sessionExpiry: now + 300, // 5 mins
  };
}