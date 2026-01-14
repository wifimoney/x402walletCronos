import { z } from "zod";

export const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address");

export const UIntStringSchema = z
  .string()
  .regex(/^\d+$/, "Expected uint as decimal string");

export const ChainSchema = z.object({
  network: z.enum(["cronos-testnet", "cronos-mainnet"]),
  chainId: z.union([z.literal(338), z.literal(25)]),
  rpcUrl: z.string().url(),
  explorerBaseUrl: z.string().url(),
});

export const SwapIntentSchema = z.object({
  kind: z.literal("swap"),
  router: AddressSchema,
  tokenIn: AddressSchema,
  tokenOut: AddressSchema,
  amountIn: UIntStringSchema,      // base units (USDC.e = 6 decimals)
  minAmountOut: UIntStringSchema,  // base units
  slippageBps: z.number().int().min(0).max(500),
  deadlineUnix: z.number().int(),
  recipient: AddressSchema,
});

export const ActionIntentSchema = z.object({
  id: z.string().min(8),
  createdAtUnix: z.number().int(),
  expiresAtUnix: z.number().int(),
  chain: ChainSchema,
  action: SwapIntentSchema,
  rationale: z.string().max(500).optional(),
});

export const PolicyDecisionSchema = z.object({
  allowed: z.boolean(),
  rulesTriggered: z.array(z.string()),
  reason: z.string().max(500).optional(),
});

export const PreflightResultSchema = z.object({
  health: z.object({
    facilitatorOk: z.boolean(),
    facilitatorLatencyMs: z.number().int().nonnegative().optional(),
    rpcOk: z.boolean(),
    rpcLatencyMs: z.number().int().nonnegative().optional(),
  }),
  simulation: z.object({
    success: z.boolean(),
    expectedAmountOut: UIntStringSchema.optional(),
    gasEstimate: UIntStringSchema.optional(),
    revertReason: z.string().max(300).optional(),
  }),
});

export const X402PaymentReceiptSchema = z.object({
  ok: z.boolean(),
  receiptId: z.string().optional(),
  txHash: z.string().optional(),
  error: z.string().optional(),
});

export const ExecutionReceiptSchema = z.object({
  txHash: z.string(),
  status: z.enum(["success", "reverted"]),
});

export const TraceEventSchema = z.object({
  tsUnix: z.number().int(),
  step: z.enum(["plan", "policy", "preflight", "pay", "execute"]),
  ok: z.boolean(),
  message: z.string().max(300),
});

export const RunReceiptSchema = z.object({
  intent: ActionIntentSchema,
  policy: PolicyDecisionSchema,
  preflight: PreflightResultSchema,
  payment: X402PaymentReceiptSchema.optional(),
  execution: ExecutionReceiptSchema.optional(),
  trace: z.array(TraceEventSchema),
  dryRun: z.boolean(),
});

export type ActionIntent = z.infer<typeof ActionIntentSchema>;
export type RunReceipt = z.infer<typeof RunReceiptSchema>;