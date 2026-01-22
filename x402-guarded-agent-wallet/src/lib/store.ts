// Simple in-memory store for hackathon/demo.
// Replace with SQLite/Prisma later if you want persistence.

type PaymentRecord = {
  intentId: string;
  nonce?: string;
  settledTxHash?: string;
  receipt?: unknown;
  verified?: boolean; // New field
  settled?: boolean;  // New field
  ts: number;
};

const paidByIntent = new Map<string, PaymentRecord>();

export function markPaid(record: PaymentRecord) {
  paidByIntent.set(record.intentId, record);
}

export function getPaid(intentId: string) {
  return paidByIntent.get(intentId) ?? null;
}

const executedByIntent = new Set<string>();

export function markExecuted(intentId: string) {
  executedByIntent.add(intentId);
}

export function isExecuted(intentId: string) {
  return executedByIntent.has(intentId);
}

// Idempotency storage: map idempotencyKey -> RunReceipt
const runByIdempotencyKey = new Map<string, any>();

export function storeRunByIdempotencyKey(idempotencyKey: string, receipt: any) {
  runByIdempotencyKey.set(idempotencyKey, receipt);
}

export function getRunByIdempotencyKey(idempotencyKey: string): any | null {
  return runByIdempotencyKey.get(idempotencyKey) ?? null;
}