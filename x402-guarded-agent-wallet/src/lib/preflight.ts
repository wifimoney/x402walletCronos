import { createPublicClient, http, parseAbi, isAddress } from "viem";
import { z } from "zod";
import {
  CRONOS_NETWORK,
  CRONOS_RPC_URL,
  FACILITATOR_BASE_URL,
} from "./constants";
import type { ActionIntent, PreflightReceipt } from "./types";
import { fetchJsonWithRetry } from "./http";

const Erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

export const PreflightInputSchema = z.object({
  intent: z.object({
    action: z.literal("swap"),
    params: z.object({
      tokenIn: z.string(),
      tokenOut: z.string(),
      amountIn: z.string(),
      maxSlippageBps: z.number().int().min(0).max(10_000),
      deadline: z.number().int(),
    }),
    fee: z.string(),
    sessionExpiry: z.number().int(),
  }),
});

export async function runPreflight(intent: ActionIntent, opts?: { walletAddress?: `0x${string}` }): Promise<PreflightReceipt> {
  const ts = Date.now();

  const receipt: PreflightReceipt = {
    ok: false,
    health: {
      facilitatorUp: false,
      supportedOk: false,
      rpcUp: false,
      latencyMs: {},
    },
    ts,
  };

  try {
    // 1) Facilitator healthcheck
    type Health = { status: string; results?: unknown };
    const h = await fetchJsonWithRetry<Health>(
      `${FACILITATOR_BASE_URL}/healthcheck`,
      { method: "GET" },
      { retries: 1, timeoutMs: 6_000 }
    );
    receipt.health.facilitatorUp = h.data?.status === "success";
    receipt.health.latencyMs.facilitator = h.ms;

    // 2) Supported kinds (sanity)
    type Supported = { kinds: Array<{ x402Version: number; scheme: string; network: string }> };
    const s = await fetchJsonWithRetry<Supported>(
      `${FACILITATOR_BASE_URL}/v2/x402/supported`,
      { method: "GET" },
      { retries: 1, timeoutMs: 6_000 }
    );
    const supported = s.data?.kinds?.find(
      (k) => k.x402Version === 1 && k.scheme === "exact" && k.network === CRONOS_NETWORK
    );
    receipt.health.supportedOk = !!supported;
    if (supported) {
      receipt.health.supported = {
        network: supported.network,
        scheme: supported.scheme,
        x402Version: supported.x402Version,
      };
    }

    // 3) RPC basic call
    const client = createPublicClient({
      transport: http((intent as any).simulateRpcDown ? "https://down.rpc" : CRONOS_RPC_URL),
      chain: undefined as any, // we only use raw calls
    });

    const rpcStarted = Date.now();
    try {
      await client.getBlockNumber();
      receipt.health.rpcUp = true;
      receipt.health.latencyMs.rpc = Date.now() - rpcStarted;
    } catch (e) {
      receipt.health.rpcUp = false;
      receipt.health.latencyMs.rpc = Date.now() - rpcStarted; // track timeout/fail time
      receipt.error = "RPC_DOWN";
      receipt.ok = false;
      return receipt;
    }

    // 4) Balance Check (replaces Quote)
    const token = intent.params.token as `0x${string}`;
    const amount = BigInt(intent.params.amount);
    const fee = BigInt(intent.fee || "0");
    const requiredTotal = amount + fee;

    // Default: Check sender's balance (in a real scenario, we'd need the sender address here)
    // For preflight simulation without a connected wallet context passed in, we might assume
    // the user has funds OR just verify the token contract exists.
    // However, the intent does NOT contain the 'from' address.
    // We will update the preflight signature to accept an optional 'from'.
    // If 'from' is missing, we skip the specific balance check or assume 0.

    // For this demo refactor, we just verify the token exists by calling decimals().

    try {
      await client.readContract({
        address: token,
        abi: Erc20Abi,
        functionName: "decimals",
      });

      // Check actual balance if wallet address is provided
      let balanceStr = "unknown (wallet not connected in preflight)";
      let sufficientForAmount = true; // assume true
      let sufficientForTotal = true; // assume true

      if (opts?.walletAddress && isAddress(opts.walletAddress)) {
        try {
          const balance = await client.readContract({
            address: token,
            abi: Erc20Abi,
            functionName: "balanceOf",
            args: [opts.walletAddress],
          }) as bigint;

          balanceStr = balance.toString();
          sufficientForAmount = balance >= amount;
          sufficientForTotal = balance >= requiredTotal;
        } catch (e) {
          balanceStr = "error reading balance";
          sufficientForAmount = false;
          sufficientForTotal = false;
        }
      }

      receipt.data = {
        balance: balanceStr,
        sufficient: sufficientForAmount,
        sufficientForTotal,
        requiredTotal: requiredTotal.toString(),
      };

      receipt.simulation = {
        success: true,
        notes: opts?.walletAddress
          ? `Token contract verified. Balance: ${balanceStr}, Sufficient: ${sufficientForAmount}`
          : "Token contract verified. Balance check deferred to execution.",
        revertReason: null,
      };

    } catch (e) {
      receipt.simulation = {
        success: false,
        notes: "Token validation failed (decimals call reverted).",
        revertReason: "INVALID_TOKEN",
      };
      receipt.ok = false;
      return receipt;
    }

    receipt.ok =
      receipt.health.facilitatorUp &&
      receipt.health.supportedOk &&
      receipt.health.rpcUp;

    return receipt;
  } catch (e: any) {
    receipt.error = e?.message ?? String(e);
    receipt.ok = false;
    return receipt;
  }
}