import {
  Facilitator,
  CronosNetwork,
  Contract,
  PaymentRequirements
} from "@crypto.com/facilitator-client";
import { randomBytes } from "crypto";
import { createPublicClient, http, parseAbi } from "viem";
import { z } from "zod";
import {
  CHAIN_ID,
  CRONOS_NETWORK,
  CRONOS_RPC_URL,
  SELLER_ADDRESS,
  USDC_E,
} from "./constants";
import { fetchJsonWithRetry } from "./http"; // Kept if needed, but SDK handles http
import type { X402DecodedPaymentHeader, X402PaymentRequirements } from "./types";

const ERC20NameAbi = parseAbi(["function name() view returns (string)"]);

export const RequirementsReqSchema = z.object({
  amount: z.string(), // USDC.e base units
  intentId: z.string().min(6), // required for payment keying
});

export const SettleReqSchema = z.object({
  intentId: z.string().min(6), // required for payment keying
  paymentHeader: z.string(), // base64 string
  // We relax validation slightly to allow passing through whatever the client sends back
  // but ultimately the SDK validates it.
  paymentRequirements: z.any(),
});

// Configure SDK
const sdkNetwork = CRONOS_NETWORK === "cronos-mainnet"
  ? CronosNetwork.CronosMainnet
  : CronosNetwork.CronosTestnet;

const facilitator = new Facilitator({
  network: sdkNetwork,
});

/*
 * Uses SDK to build requirements (standardized).
 * Still manually constructs EIP-712 Typed Data for the client to sign,
 * because the SDK's generatePaymentHeader requires a server-side signer.
 */
export async function buildPaymentRequirements(amount: string): Promise<{
  requirements: X402PaymentRequirements;
  typedData: any;
  nonce: `0x${string}`;
}> {
  if (!SELLER_ADDRESS) throw new Error("SELLER_ADDRESS not set");

  // SDK Asset Contract
  const assetContract = sdkNetwork === CronosNetwork.CronosMainnet
    ? Contract.USDCe
    : Contract.DevUSDCe;

  // Use SDK to generate the requirements object
  // output is PaymentRequirements interface from SDK
  const sdkReqs = facilitator.generatePaymentRequirements({
    payTo: SELLER_ADDRESS,
    asset: assetContract,
    description: "Agent Verification Fee",
    maxAmountRequired: amount,
    maxTimeoutSeconds: 300,
  });

  // Fetch token name for EIP-712 domain
  // We could hardcode "USDC" but fetching is safer
  // We use our existing viem client for this light read
  const client = createPublicClient({ transport: http(CRONOS_RPC_URL) });
  const tokenName = await client.readContract({
    address: sdkReqs.asset as `0x${string}`,
    abi: ERC20NameAbi,
    functionName: "name",
  });

  const now = Math.floor(Date.now() / 1000);
  const nonce = (`0x${randomBytes(32).toString("hex")}`) as `0x${string}`;

  // EIP-3009 TransferWithAuthorization typed data
  const typedData = {
    domain: {
      name: tokenName,
      version: "1",
      chainId: CHAIN_ID[CRONOS_NETWORK],
      verifyingContract: sdkReqs.asset,
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
      // from is filled client-side
      from: "0x0000000000000000000000000000000000000000",
      to: sdkReqs.payTo,
      value: sdkReqs.maxAmountRequired,
      validAfter: 0,
      validBefore: now + 60, // 60s
      nonce,
    },
  };

  return {
    requirements: sdkReqs as unknown as X402PaymentRequirements,
    typedData,
    nonce
  };
}

export function encodePaymentHeader(decoded: X402DecodedPaymentHeader): string {
  return Buffer.from(JSON.stringify(decoded), "utf8").toString("base64");
}

/*
 * Uses SDK to verify and settle.
 */
export async function verifyAndSettle(payload: {
  paymentHeader: string;
  paymentRequirements: PaymentRequirements;
}): Promise<{ verify: any; settle?: any }> {

  // SDK: Verify
  const requestBody = facilitator.buildVerifyRequest(payload.paymentHeader, payload.paymentRequirements);
  const verify = await facilitator.verifyPayment(requestBody);

  if (!verify.isValid) {
    return { verify };
  }

  // SDK: Settle
  try {
    const settle = await facilitator.settlePayment(requestBody);
    return { verify, settle };
  } catch (err: any) {
    // Basic error wrapping if settlement fails (e.g. timeout or internal error)
    return {
      verify,
      settle: {
        x402Version: 1,
        event: "payment.failed",
        network: sdkNetwork,
        error: err.message || "Unknown settlement error"
      }
    };
  }
}