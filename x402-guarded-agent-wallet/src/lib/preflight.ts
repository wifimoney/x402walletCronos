import { createPublicClient, http, parseAbi, isAddress } from "viem";
import { z } from "zod";
import {
  CRONOS_NETWORK,
  CRONOS_RPC_URL,
  FACILITATOR_BASE_URL,
  ROUTER_ADDRESS,
} from "./constants";
import type { ActionIntent, PreflightReceipt } from "./types";
import { fetchJsonWithRetry } from "./http";

const RouterAbi = parseAbi([
  "function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] memory amounts)",
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

export async function runPreflight(intent: ActionIntent): Promise<PreflightReceipt> {
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
    receipt.health.supportedOk = !!s.data?.kinds?.some(
      (k) => k.x402Version === 1 && k.scheme === "exact" && k.network === CRONOS_NETWORK
    );

    // 3) RPC basic call
    const client = createPublicClient({
      transport: http(CRONOS_RPC_URL),
      chain: undefined as any, // we only use raw calls
    });

    const rpcStarted = Date.now();
    await client.getBlockNumber();
    receipt.health.rpcUp = true;
    receipt.health.latencyMs.rpc = Date.now() - rpcStarted;

    // 4) Quote “simulation”
    const tokenIn = intent.params.tokenIn as `0x${string}`;
    const tokenOut = intent.params.tokenOut as `0x${string}`;

    if (!isAddress(ROUTER_ADDRESS) || ROUTER_ADDRESS === ("0x" + "0".repeat(40))) {
      receipt.simulation = {
        success: false,
        notes: "Router not configured (ROUTER_ADDRESS). Quote/sim skipped.",
        revertReason: null,
      };
      receipt.ok = receipt.health.facilitatorUp && receipt.health.supportedOk && receipt.health.rpcUp;
      return receipt;
    }

    if (!isAddress(tokenIn) || !isAddress(tokenOut) || tokenOut === ("0x" + "0".repeat(40))) {
      receipt.simulation = {
        success: false,
        notes: "tokenOut not configured for this network yet. Set a valid WCRO/tokenOut.",
        revertReason: null,
      };
      receipt.ok = false;
      return receipt;
    }

    const amounts = await client.readContract({
      address: ROUTER_ADDRESS,
      abi: RouterAbi,
      functionName: "getAmountsOut",
      args: [BigInt(intent.params.amountIn), [tokenIn, tokenOut]],
    });

    const expectedOut = (amounts as bigint[])[(amounts as bigint[]).length - 1].toString();
    const slippageBps = intent.params.maxSlippageBps;
    const minOut = (BigInt(expectedOut) * BigInt(10_000 - slippageBps)) / BigInt(10_000);

    receipt.quote = {
      expectedOut,
      minOut: minOut.toString(),
      path: [tokenIn, tokenOut]
    };
    receipt.simulation = {
      success: true,
      notes: "Quote via getAmountsOut succeeded (acts as a staticcall preflight).",
      revertReason: null,
    };

    receipt.ok =
      receipt.health.facilitatorUp &&
      receipt.health.supportedOk &&
      receipt.health.rpcUp &&
      !!receipt.quote?.expectedOut;

    return receipt;
  } catch (e: any) {
    receipt.error = e?.message ?? String(e);
    receipt.ok = false;
    return receipt;
  }
}