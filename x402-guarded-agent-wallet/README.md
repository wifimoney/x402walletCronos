# x402 Guarded Agent Wallet (Hackathon Edition)

A **guarded agentic execution flow** on **Cronos Testnet**: the agent only executes an on-chain action after **(1) preflight checks**, **(2) one-time x402 authorization**, and returns **auditable receipts** (human + JSON).

Workflow: **Intent → Plan → Policy Checks → Preflight → x402 Pay → Execute → Receipts**

## 🏷️ Tracks
- Main Track — x402 Applications (Broad Use Cases)
- x402 Agentic Finance/Payment Track — Advanced Programmatic Settlement & Workflows
- Dev Tooling & Data Virtualization Track

## 🚀 Key Features
- **Guarded Execution:** Every action is gated by policy checks (slippage/caps/expiry) and preflight simulation before any on-chain execution.
- **Preflight Harness:** Facilitator health + supported network checks, RPC health checks, and route/quote simulation (`expectedOut` + enforced `minOut`).
- **x402 Integration:** x402-compatible payment flow with explicit trace steps (**requirements → verify → settle**).
- **ReceiptKit (Dev Tooling):** Machine-readable JSON receipts + human timeline, including policy decisions, preflight outcomes, payment receipt, and tx hashes.
- **Robust Workflow:** Idempotency, session expiry, route optimization (direct vs hop).
- **Failure Testing:** UI toggles to simulate RPC failures / expired intents.

## 🛠️ Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Chain:** Cronos Testnet (EVM)
- **Web3:** Viem
- **Validation:** Zod

## 🏁 Getting Started

### 1) Install
```bash
npm install
```

### 2) Configure

Create `.env.local`:

```bash
NEXT_PUBLIC_CRONOS_NETWORK=cronos-testnet
CRONOS_RPC_URL=https://evm-t3.cronos.org

# Facilitator API base (local or official)
FACILITATOR_BASE_URL=http://localhost:3000

SELLER_ADDRESS=0x71C95911E9a5D330f46a1D580242049ee2724330

# Router + token addresses (testnet)
ROUTER_ADDRESS=0x2fFA3085D833C5c9ec6cdCF08480F53F33a1D42a
USDC_E_ADDRESS=0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0
WCRO_ADDRESS=0x6a3173618859C7cd8452b20fb5deAB01d4D64006

NEXT_PUBLIC_EXPLORER_TX_BASE=https://explorer.cronos.org/testnet/tx/
```

### 3) Run

```bash
npm run dev
```

### 🎬 Demo Flow (90s)
1.	Prompt: “Swap 10 USDC.e to WCRO”
2.	Run (Plan → Preflight): generates ActionIntent, applies policy checks, runs facilitator + RPC health, simulates route, computes minOut
3.	Pay Agent Fee (x402): x402 verify + settle (receipt tx hash)
4.	Execute: client signs approve (if needed) + swap (minOut enforced in calldata)
5.	Receipts: explorer links, before/after balances, policy log, trace timeline, JSON copy

### � Failure Modes (Demo)
*	RPC down → preflight fails → payment/execution blocked
*	Expired intent → execution blocked
*	No liquidity route → preflight fails with reason

### ✅ Proof (Testnet)
*	x402 settle tx hash: TBD
*	swap tx hash: TBD
*	receipts include: expectedOut, enforced minOut, before/after balances, trace + JSON

### 📦 Deployment (Vercel)
1.	Import repo into Vercel
2.	Add env vars
3.	Set FACILITATOR_BASE_URL to your deployed URL