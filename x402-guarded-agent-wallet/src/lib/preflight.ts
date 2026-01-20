import { createPublicClient, http, parseAbi, isAddress } from "viem";
import { z } from "zod";
import {
  CRONOS_NETWORK,
  CRONOS_RPC_URL,
  FACILITATOR_BASE_URL,
  ROUTER_ADDRESS,
  PHOTON,
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

    // 4) Quote “simulation” / Route Discovery
    const tokenIn = intent.params.tokenIn as `0x${string}`;
    const tokenOut = intent.params.tokenOut as `0x${string}`;
    const photon = PHOTON[CRONOS_NETWORK];

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

    // Define paths to try
    const pathsToTry: `0x${string}`[][] = [];
    pathsToTry.push([tokenIn, tokenOut]); // Direct
    if (photon && photon !== tokenIn && photon !== tokenOut) {
      pathsToTry.push([tokenIn, photon, tokenOut]); // Hop via PHOTON
    }
    // Sanity check path (just to see if we can quote *anything* if main fails?)
    // kept simple: strictly trying to get to tokenOut.

    let bestQuote: { amountOut: bigint; path: `0x${string}`[] } | null = null;
    const pathsTriedLog: string[][] = [];

    for (const path of pathsToTry) {
      pathsTriedLog.push(path);
      try {
        const amounts = await client.readContract({
          address: ROUTER_ADDRESS,
          abi: RouterAbi,
          functionName: "getAmountsOut",
          args: [BigInt(intent.params.amountIn), path],
        }) as bigint[];

        const out = amounts[amounts.length - 1];
        if (!bestQuote || out > bestQuote.amountOut) {
          bestQuote = { amountOut: out, path };
        }
      } catch (e) {
        // ignore path failure, try next
      }
    }

    if (!bestQuote) {
      receipt.quote = {
        expectedOut: "0",
        minOut: "0",
        path: [],
        pathUsed: [],
        pathsTried: pathsTriedLog,
      };
      receipt.simulation = {
        success: false,
        notes: "No valid route found (all attempted paths reverted or returned 0).",
        revertReason: "NO_ROUTE",
      };
      receipt.ok = false;
      return receipt;
    }

    const expectedOut = bestQuote.amountOut.toString();
    const slippageBps = intent.params.maxSlippageBps;
    const minOut = (bestQuote.amountOut * BigInt(10_000 - slippageBps)) / BigInt(10_000);

    receipt.quote = {
      expectedOut,
      minOut: minOut.toString(),
      path: bestQuote.path,
      pathUsed: bestQuote.path,
      pathsTried: pathsTriedLog,
    };
    receipt.simulation = {
      success: true,
      notes: "Quote via getAmountsOut succeeded.",
      revertReason: null,
    };

    receipt.ok =
      receipt.health.facilitatorUp &&
      receipt.health.supportedOk &&
      receipt.health.rpcUp &&
      !!receipt.quote?.expectedOut &&
      receipt.quote.expectedOut !== "0";

    return receipt;
  } catch (e: any) {
    receipt.error = e?.message ?? String(e);
    receipt.ok = false;
    return receipt;
  }
}