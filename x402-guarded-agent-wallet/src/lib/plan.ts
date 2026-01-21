import { nanoid } from "nanoid";
import { CRONOS_NETWORK, USDC_E } from "./constants";
import type { ActionIntent } from "./types";

function toBaseUnits(amount: number, decimals: number) {
  // Avoid float issues for simple inputs: support up to 6 decimals here.
  const s = amount.toFixed(decimals);
  const [a, b] = s.split(".");
  return a + (b ?? "").padEnd(decimals, "0");
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

  // Default to self/burner if not specified (for demo reliability)
  // In a real app, recipient comes from prompt or state.
  // Here we default to a known testnet "safe" address or the caller's address if passed in opts.
  const to = opts.recipient && opts.recipient !== ("0x" + "0".repeat(40))
    ? opts.recipient
    : "0x0000000000000000000000000000000000000000"; //Burner for test, or could be another wallet

  const fee = toBaseUnits(1, 6); // 1 USDC.e agent fee

  return {
    id: nanoid(10),
    createdAt: now,
    action: "transfer",
    params: {
      token,
      to,
      amount,
    },
    fee,
    sessionExpiry: now + 300, // 5 mins
  };
}