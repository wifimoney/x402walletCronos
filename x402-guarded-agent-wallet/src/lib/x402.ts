import { randomBytes } from "crypto";
import { createPublicClient, http, parseAbi } from "viem";
import { z } from "zod";
import {
  CHAIN_ID,
  CRONOS_NETWORK,
  CRONOS_RPC_URL,
  FACILITATOR_BASE_URL,
  SELLER_ADDRESS,
  USDC_E,
} from "./constants";
import type { X402DecodedPaymentHeader, X402PaymentRequirements } from "./types";
import { fetchJsonWithRetry } from "./http";

const ERC20NameAbi = parseAbi(["function name() view returns (string)"]);

export const RequirementsReqSchema = z.object({
  amount: z.string(), // USDC.e base units
  intentId: z.string().min(6), // required for payment keying
});

export const SettleReqSchema = z.object({
  intentId: z.string().min(6), // required for payment keying
  paymentHeader: z.string(), // base64 string
  paymentRequirements: z.object({
    scheme: z.literal("exact"),
    network: z.union([z.literal("cronos-testnet"), z.literal("cronos-mainnet")]),
    payTo: z.string(),
    asset: z.string(),
    maxAmountRequired: z.string(),
    maxTimeoutSeconds: z.number(),
  }),
});

type FacilitatorVerifyResponse = { isValid: boolean; invalidReason: string | null };
type FacilitatorSettleResponse =
  | {
    x402Version: 1;
    event: "payment.settled";
    txHash: `0x${string}`;
    from: `0x${string}`;
    to: `0x${string}`;
    value: string;
    blockNumber: number;
    network: string;
    timestamp: string;
  }
  | {
    x402Version: 1;
    event: "payment.failed";
    network: string;
    error?: string;
    message?: string;
  };

// In-memory “idempotency”: nonce -> settled response
const settledCache = new Map<string, FacilitatorSettleResponse>();

export async function buildPaymentRequirements(amount: string): Promise<{
  requirements: X402PaymentRequirements;
  typedData: any;
  nonce: `0x${string}`;
}> {
  if (!SELLER_ADDRESS) throw new Error("SELLER_ADDRESS not set");
  const asset = USDC_E[CRONOS_NETWORK];

  const client = createPublicClient({ transport: http(CRONOS_RPC_URL) });
  const tokenName = await client.readContract({
    address: asset,
    abi: ERC20NameAbi,
    functionName: "name",
  });

  const now = Math.floor(Date.now() / 1000);
  const validAfter = 0;
  const validBefore = now + 60; // 60s one-time window
  const nonce = (`0x${randomBytes(32).toString("hex")}`) as `0x${string}`;

  const requirements: X402PaymentRequirements = {
    scheme: "exact",
    network: CRONOS_NETWORK,
    payTo: SELLER_ADDRESS,
    asset,
    maxAmountRequired: amount,
    maxTimeoutSeconds: 300,
  };

  // EIP-3009 TransferWithAuthorization typed data
  // NOTE: version is commonly "1" for many ERC3009 tokens; we keep it simple for demo.
  const typedData = {
    domain: {
      name: tokenName,
      version: "1",
      chainId: CHAIN_ID[CRONOS_NETWORK],
      verifyingContract: asset,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      // from is filled client-side once we know wallet address
      from: "0x0000000000000000000000000000000000000000",
      to: SELLER_ADDRESS,
      value: amount,
      validAfter,
      validBefore,
      nonce,
    },
  };

  return { requirements, typedData, nonce };
}

export function encodePaymentHeader(decoded: X402DecodedPaymentHeader): string {
  return Buffer.from(JSON.stringify(decoded), "utf8").toString("base64");
}

export async function verifyAndSettle(payload: {
  paymentHeader: string;
  paymentRequirements: X402PaymentRequirements;
}): Promise<{ verify: FacilitatorVerifyResponse; settle?: FacilitatorSettleResponse }> {
  const decoded = JSON.parse(Buffer.from(payload.paymentHeader, "base64").toString("utf8")) as X402DecodedPaymentHeader;
  const nonce = decoded?.payload?.nonce;

  if (nonce && settledCache.has(nonce)) {
    return { verify: { isValid: true, invalidReason: null }, settle: settledCache.get(nonce)! };
  }

  const body = {
    x402Version: 1,
    paymentHeader: payload.paymentHeader,
    paymentRequirements: payload.paymentRequirements,
  };

  const verify = await fetchJsonWithRetry<FacilitatorVerifyResponse>(
    `${FACILITATOR_BASE_URL}/v2/x402/verify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X402-Version": "1" },
      body: JSON.stringify(body),
    },
    { retries: 1, timeoutMs: 12_000 }
  );

  if (!verify.data.isValid) {
    return { verify: verify.data };
  }

  const settle = await fetchJsonWithRetry<FacilitatorSettleResponse>(
    `${FACILITATOR_BASE_URL}/v2/x402/settle`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X402-Version": "1" },
      body: JSON.stringify(body),
    },
    { retries: 2, timeoutMs: 20_000 }
  );

  if (nonce) settledCache.set(nonce, settle.data);
  return { verify: verify.data, settle: settle.data };
}