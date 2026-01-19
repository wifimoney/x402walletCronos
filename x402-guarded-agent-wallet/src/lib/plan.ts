import { nanoid } from "nanoid";
import { CRONOS_NETWORK, USDC_E, WCRO, ROUTER_ADDRESS } from "./constants";
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

  // MVP parse: "Swap 10 USDC.e to CRO"
  // Extract first number; fallback to 10.
  const m = opts.prompt.match(/(\d+(\.\d+)?)/);
  const amount = m ? Number(m[1]) : 10;

  // USDC.e is 6 decimals
  const amountIn = toBaseUnits(amount, 6);

  const tokenIn = USDC_E[CRONOS_NETWORK];
  const tokenOut = WCRO[CRONOS_NETWORK]; // may be 0x0 on testnet until you set it

  const fee = toBaseUnits(1, 6); // 1 USDC.e agent fee
  const maxSlippageBps = 50; // 0.50%

  return {
    id: nanoid(10),
    createdAt: now,
    action: "swap",
    params: {
      tokenIn,
      tokenOut,
      amountIn,
      maxSlippageBps,
      deadline: now + 60,
    },
    fee,
    sessionExpiry: now + 60,
  };
}