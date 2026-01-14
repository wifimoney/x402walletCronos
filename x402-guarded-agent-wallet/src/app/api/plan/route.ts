import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { ActionIntentSchema } from "@/lib/shared/schemas";
import { CHAIN, NETWORK, ROUTERS, TOKEN } from "@/lib/shared/constants";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompt: string = body?.prompt || "";

  // MVP deterministic parse (LLM later)
  // Accept only the canonical demo prompt for now.
  if (!prompt.toLowerCase().includes("swap")) {
    return NextResponse.json({ error: "Unsupported prompt (MVP: swap only)" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const chain = CHAIN[NETWORK];

  const usdce =
    NETWORK === "cronos-testnet" ? TOKEN.USDCE.testnet : TOKEN.USDCE.mainnet;

  // NOTE: You’ll replace tokenOut with WCRO/CRO token address later.
  // For scaffold: just set tokenOut = tokenIn so it validates; simulation will be added in P2.
  const tokenOut = usdce;

  const intent = {
    id: nanoid(),
    createdAtUnix: now,
    expiresAtUnix: now + 60,
    chain: {
      network: NETWORK,
      chainId: chain.chainId,
      rpcUrl: chain.rpcUrl,
      explorerBaseUrl: chain.explorerBaseUrl,
    },
    action: {
      kind: "swap",
      router: ROUTERS.VVS_MAINNET || "0x0000000000000000000000000000000000000000",
      tokenIn: usdce,
      tokenOut,
      amountIn: "10000000", // 10 USDC.e in 6 decimals
      minAmountOut: "0",
      slippageBps: 50,
      deadlineUnix: now + 60,
      recipient: body?.recipient || "0x0000000000000000000000000000000000000000",
    },
    rationale: "MVP deterministic plan: swap-only intent envelope",
  };

  const parsed = ActionIntentSchema.safeParse(intent);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 500 });
  }

  return NextResponse.json(parsed.data);
}