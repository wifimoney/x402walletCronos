# x402 Guarded Agent Wallet - Testnet Deployment Checklist

## ✅ Current Status

### What's Working
- ✅ **Build System**: Next.js builds successfully with no TypeScript errors
- ✅ **Core Architecture**: Complete workflow (Plan → Policy → Preflight → Pay → Execute)
- ✅ **x402 Integration**: Facilitator SDK integrated for payment requirements, verify, and settle
- ✅ **UI**: Full "CronoGuard Control Tower" dashboard with run history and receipts
- ✅ **Type Safety**: All TypeScript types properly defined
- ✅ **Preflight System**: Health checks, route discovery, and quote simulation
- ✅ **Policy Engine**: Guards with slippage caps, amount limits, and expiry checks
- ✅ **Risk Analysis**: Risk scoring system integrated into receipts

---

## 🔧 What Needs to Be Done (Testnet Operational)

### 1. **Environment Configuration** ⚠️ CRITICAL

**Current State:**
```env
NEXT_PUBLIC_CRONOS_NETWORK=cronos-testnet
CRONOS_RPC_URL=https://evm-t3.cronos.org
FACILITATOR_BASE_URL=http://localhost:3000  # ⚠️ NEEDS UPDATE
SELLER_ADDRESS=0x71C95911E9a5D330f46a1D580242049ee2724330
ROUTER_ADDRESS=0x2fFA3085D833C5c9ec6cdCF08480F53F33a1D42a
NEXT_PUBLIC_EXPLORER_TX_BASE=https://explorer.cronos.org/testnet/tx/
```

**Required Actions:**
- [ ] **Update `FACILITATOR_BASE_URL`** to the official Cronos facilitator endpoint
  - Current: `http://localhost:3000` (local dev only)
  - Required: `https://facilitator.cronoslabs.org` or official testnet URL
  - **Impact**: Without this, x402 payment verification/settlement will fail
  
- [ ] **Verify `SELLER_ADDRESS`** is your actual wallet address
  - This is where x402 agent fees will be sent
  - Must be a wallet you control
  - Recommend: Use a dedicated testnet wallet for fee collection

- [ ] **Confirm `ROUTER_ADDRESS`** is correct for Cronos testnet
  - Current: `0x2fFA3085D833C5c9ec6cdCF08480F53F33a1D42a`
  - Verify this is a valid VVS Finance or compatible DEX router on testnet
  - Test with a direct call to `getAmountsOut` to ensure it's operational

- [ ] **Add missing token addresses to `.env.local`**:
  ```env
  USDC_E_ADDRESS=0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0
  WCRO_ADDRESS=0x6a3173618859C7cd8452b20fb5deAB01d4D64006
  ```
  (These are referenced in README but not in `.env.local`)

---

### 2. **Facilitator API Verification** ⚠️ CRITICAL

**What to Test:**
```bash
# 1. Health check
curl https://facilitator.cronoslabs.org/healthcheck

# 2. Supported schemes
curl https://facilitator.cronoslabs.org/v2/x402/supported
```

**Expected Response:**
- Health: `{"status": "success"}`
- Supported: Should include `{"x402Version": 1, "scheme": "exact", "network": "cronos-testnet"}`

**Required Actions:**
- [ ] Verify facilitator is reachable and healthy
- [ ] Confirm `cronos-testnet` is in the supported networks list
- [ ] Test the full x402 flow (requirements → verify → settle) with a small amount
- [ ] If using self-hosted facilitator, ensure it's deployed and accessible

**Files to Check:**
- `src/lib/x402.ts` (lines 40-42): Facilitator SDK initialization
- `src/lib/preflight.ts` (lines 49-74): Facilitator health checks

---

### 3. **Testnet Token Setup** ⚠️ CRITICAL

**Current Token Configuration:**
- **USDC.e**: `0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0` (testnet)
- **WCRO**: `0x6a3173618859C7cd8452b20fb5deAB01d4D64006` (VVS testnet)
- **PHOTON**: `0xc21223249CA28397B4B6541dfFaEcC539BfF0c59` (intermediate hop token)

**Required Actions:**
- [ ] **Obtain testnet USDC.e tokens**
  - Need at least 25 USDC.e for testing (policy cap is 25 USDC.e)
  - Check if there's a testnet faucet or request from Cronos team
  
- [ ] **Verify token contracts are valid**
  ```bash
  # Check USDC.e name/symbol
  cast call 0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0 "name()(string)" --rpc-url https://evm-t3.cronos.org
  cast call 0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0 "symbol()(string)" --rpc-url https://evm-t3.cronos.org
  ```

- [ ] **Test router liquidity**
  - Verify there's actual liquidity for USDC.e → WCRO on testnet
  - Test `getAmountsOut` call manually:
    ```bash
    cast call $ROUTER_ADDRESS "getAmountsOut(uint256,address[])(uint256[])" \
      10000000 "[0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0,0x6a3173618859C7cd8452b20fb5deAB01d4D64006]" \
      --rpc-url https://evm-t3.cronos.org
    ```
  - If this fails, you may need to:
    - Use a different router
    - Add liquidity to the pool
    - Use different token pairs

---

### 4. **Wallet Connection & Network Switching** ✅ IMPLEMENTED

**Current State:**
- ConnectBar component handles wallet connection
- Network check: `wallet?.chainId === 338` (Cronos testnet)
- UI gates actions based on correct network

**Required Actions:**
- [ ] Test wallet connection with MetaMask/other wallets
- [ ] Verify network switching prompts work correctly
- [ ] Ensure Cronos testnet (Chain ID 338) is added to wallet
  - Network Name: Cronos Testnet
  - RPC URL: https://evm-t3.cronos.org
  - Chain ID: 338
  - Currency Symbol: TCRO
  - Block Explorer: https://explorer.cronos.org/testnet

**Files:**
- `src/components/ConnectBar.tsx` (if exists)
- `src/app/page.tsx` (lines 74-80): Network gating logic

---

### 5. **x402 Payment Flow Testing** ⚠️ CRITICAL

**Current Implementation:**
- Requirements generation: `src/lib/x402.ts` (lines 49-119)
- EIP-712 typed data for `TransferWithAuthorization`
- Verify & Settle: `src/lib/x402.ts` (lines 128-157)
- Payment storage: `src/lib/store.ts`

**Required Actions:**
- [ ] **Test payment requirements generation**
  - Call `/api/pay/requirements` with `{amount: "1000000", intentId: "test123"}`
  - Verify typedData structure is correct
  - Confirm nonce is unique

- [ ] **Test EIP-712 signature**
  - Sign the typedData with a testnet wallet
  - Verify signature is valid

- [ ] **Test verify endpoint**
  - Send signed payment header to facilitator
  - Confirm `isValid: true` response

- [ ] **Test settle endpoint**
  - Settle the payment on-chain
  - Verify transaction hash is returned
  - Check transaction on explorer: https://explorer.cronos.org/testnet/tx/{hash}

- [ ] **Verify payment gating works**
  - Ensure execution is blocked until payment is settled
  - Test that payment record is stored by `intentId`
  - Verify "2. Pay (x402)" button state changes correctly

**Test Flow:**
1. Run preflight (should pass)
2. Click "2. Pay (x402)"
3. Sign EIP-712 message
4. Wait for settlement
5. Verify payment receipt appears in UI
6. Confirm "3. Execute Swap" button becomes enabled

---

### 6. **On-Chain Execution Testing** ⚠️ CRITICAL

**Current Implementation:**
- Prepare endpoint: `src/app/api/prepare/route.ts`
- Client-side execution: `src/app/page.tsx` (lines 203-361)
- Approve + Swap flow with balance tracking

**Required Actions:**
- [ ] **Test approve transaction**
  - Verify allowance check works
  - Test approve tx if allowance insufficient
  - Confirm approve tx hash appears in receipt

- [ ] **Test swap transaction**
  - Verify `swapExactTokensForTokens` call
  - Confirm `minOut` is enforced (from preflight)
  - Check deadline is set correctly
  - Verify path is optimal (direct or via PHOTON)

- [ ] **Test balance tracking**
  - Confirm before/after balances are captured
  - Verify deltas are calculated correctly
  - Check that balances display in receipt

- [ ] **Test explorer links**
  - Verify approve link: `https://explorer.cronos.org/testnet/tx/{approveTxHash}`
  - Verify swap link: `https://explorer.cronos.org/testnet/tx/{swapTxHash}`
  - Ensure links are clickable in UI

- [ ] **Test workflow path tracking**
  - Verify `workflowPath` includes: `["preflight", "pay", "approve", "swap"]`
  - Or: `["preflight", "pay", "approve_skipped", "swap"]` if allowance exists

**Test Flow:**
1. Complete payment (x402)
2. Click "3. Execute Swap"
3. Approve wallet prompts (approve + swap)
4. Wait for transactions to confirm
5. Verify receipt shows:
   - Both tx hashes
   - Explorer links
   - Before/after balances
   - Balance deltas
   - Enforced minOut and deadline

---

### 7. **Preflight & Health Checks** ✅ MOSTLY IMPLEMENTED

**Current Checks:**
- Facilitator health: `/healthcheck`
- Supported networks: `/v2/x402/supported`
- RPC health: `getBlockNumber()`
- Route discovery: `getAmountsOut()` with fallback paths

**Required Actions:**
- [ ] **Test RPC failure simulation**
  - Enable "Simulate RPC Fail" checkbox
  - Verify preflight fails with `RPC_DOWN` error
  - Confirm execution is blocked

- [ ] **Test route discovery**
  - Verify direct path (USDC.e → WCRO) is tried first
  - Test fallback to PHOTON hop if direct fails
  - Confirm `pathsTried` is logged in receipt

- [ ] **Test no-liquidity scenario**
  - If no route exists, verify error: `NO_ROUTE`
  - Confirm execution is blocked
  - Check error message in UI

- [ ] **Verify latency tracking**
  - Check `latencyMs.facilitator` is recorded
  - Check `latencyMs.rpc` is recorded
  - Display in receipt/trace

**Files:**
- `src/lib/preflight.ts` (lines 32-198)

---

### 8. **Policy & Risk Validation** ✅ IMPLEMENTED

**Current Policies:**
- Action must be "swap"
- Intent must not be expired
- TokenIn must be USDC.e
- Amount cap: 25 USDC.e
- Slippage cap: 2% (200 bps)
- TokenOut must be configured (WCRO)

**Risk Scoring:**
- Integrated into receipts
- Flags tracked and displayed

**Required Actions:**
- [ ] **Test policy denial scenarios**
  - Try swap > 25 USDC.e (should deny)
  - Try slippage > 2% (should deny)
  - Try non-USDC.e tokenIn (should deny)
  - Try expired intent (should deny)

- [ ] **Test risk scoring**
  - Verify risk score appears in receipt
  - Check risk flags are meaningful
  - Confirm UI displays risk badge correctly

- [ ] **Test dry-run mode**
  - Enable "Dry Run" checkbox
  - Verify execution is skipped
  - Confirm payment is not required
  - Check receipt shows `dryRun: true`

**Files:**
- `src/lib/policy.ts` (lines 6-73)
- `src/lib/risk.ts`

---

### 9. **UI/UX Polish** ✅ MOSTLY DONE

**Current Features:**
- Two-column layout (Runs list + Details)
- Tabbed receipts (Summary, Trace, JSON)
- Run history with localStorage persistence
- Risk badges and status indicators
- Gated buttons with visual feedback

**Required Actions:**
- [ ] **Test run history**
  - Create multiple runs
  - Verify they persist in localStorage
  - Test selecting different runs
  - Confirm limit of 50 runs works

- [ ] **Test receipt tabs**
  - Summary: Verify key fields are shown
  - Trace: Check timeline is chronological
  - JSON: Confirm full receipt is downloadable

- [ ] **Test error handling**
  - Trigger various errors (RPC down, no payment, etc.)
  - Verify error messages are clear
  - Check errors don't crash the UI

- [ ] **Test loading states**
  - Verify buttons show "..." when loading
  - Confirm buttons are disabled during operations
  - Check no race conditions occur

- [ ] **Mobile responsiveness**
  - Test on mobile viewport
  - Verify two-column layout stacks correctly
  - Check all buttons are accessible

**Files:**
- `src/app/page.tsx` (lines 1-620)
- `src/app/globals.css`

---

### 10. **Deployment (Vercel)** 🚀

**Required Actions:**
- [ ] **Push to GitHub**
  - Ensure all code is committed
  - Push to main/master branch

- [ ] **Import to Vercel**
  - Connect GitHub repo
  - Select Next.js framework preset

- [ ] **Configure Environment Variables**
  Add all variables from `.env.local`:
  ```
  NEXT_PUBLIC_CRONOS_NETWORK=cronos-testnet
  CRONOS_RPC_URL=https://evm-t3.cronos.org
  FACILITATOR_BASE_URL=https://facilitator.cronoslabs.org
  SELLER_ADDRESS=0x71C95911E9a5D330f46a1D580242049ee2724330
  ROUTER_ADDRESS=0x2fFA3085D833C5c9ec6cdCF08480F53F33a1D42a
  USDC_E_ADDRESS=0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0
  WCRO_ADDRESS=0x6a3173618859C7cd8452b20fb5deAB01d4D64006
  NEXT_PUBLIC_EXPLORER_TX_BASE=https://explorer.cronos.org/testnet/tx/
  ```

- [ ] **Deploy**
  - Trigger deployment
  - Wait for build to complete
  - Verify no build errors

- [ ] **Test deployed app**
  - Connect wallet to deployed URL
  - Run full flow end-to-end
  - Verify all features work in production

---

## 🧪 End-to-End Test Script (90 seconds)

### Prerequisites
1. MetaMask with Cronos testnet configured
2. Testnet TCRO for gas
3. Testnet USDC.e (at least 11 USDC.e: 10 for swap + 1 for fee)

### Test Flow
```
1. Open app → Connect wallet
   ✓ Wallet connected
   ✓ Network = Cronos Testnet (338)

2. Enter prompt: "Swap 10 USDC.e to WCRO"
   ✓ Click "1. Run Preflight"
   ✓ Wait for preflight to complete (~2-3s)
   ✓ Verify receipt shows:
     - Intent ID
     - Policy: allowed
     - Preflight: ok
     - Quote: expectedOut, minOut
     - Risk score

3. Click "2. Pay (x402)"
   ✓ Sign EIP-712 message in wallet
   ✓ Wait for settlement (~5-10s)
   ✓ Verify payment receipt appears
   ✓ Button changes to "2. Paid ✅"

4. Click "3. Execute Swap"
   ✓ Approve USDC.e (if needed) - sign in wallet
   ✓ Wait for approve tx (~5s)
   ✓ Swap - sign in wallet
   ✓ Wait for swap tx (~5s)
   ✓ Verify receipt shows:
     - Approve tx hash + link
     - Swap tx hash + link
     - Before/after balances
     - Balance deltas
     - Enforced minOut

5. Click explorer links
   ✓ Verify approve tx on explorer
   ✓ Verify swap tx on explorer
   ✓ Check x402 payment tx on explorer

6. Download JSON receipt
   ✓ Click "Download JSON"
   ✓ Verify file contains full receipt

7. Test failure modes
   ✓ Enable "Simulate RPC Fail" → Run → Should fail at preflight
   ✓ Create expired intent → Should fail at lifecycle check
```

---

## 📋 Missing/Optional Enhancements

### Not Critical for Testnet, But Nice to Have

1. **Better Error Messages**
   - More user-friendly error descriptions
   - Suggestions for fixing common issues

2. **Transaction Monitoring**
   - Real-time tx status updates
   - Retry logic for failed transactions

3. **Multi-Token Support**
   - Support tokens beyond USDC.e → WCRO
   - Dynamic token selection in UI

4. **Advanced Routing**
   - Multi-hop path optimization
   - Aggregator integration (1inch, etc.)

5. **Analytics**
   - Track successful swaps
   - Monitor gas costs
   - Risk score distribution

6. **Testing**
   - Unit tests for core functions
   - Integration tests for API routes
   - E2E tests with Playwright

---

## 🔍 Key Files Reference

### Core Logic
- `src/lib/plan.ts` - Intent generation
- `src/lib/policy.ts` - Policy evaluation
- `src/lib/preflight.ts` - Health checks & route discovery
- `src/lib/x402.ts` - x402 payment flow
- `src/lib/receipt.ts` - Receipt generation
- `src/lib/store.ts` - Payment & execution tracking

### API Routes
- `src/app/api/run/route.ts` - Main orchestration endpoint
- `src/app/api/pay/requirements/route.ts` - Payment requirements
- `src/app/api/pay/settle/route.ts` - Payment settlement
- `src/app/api/prepare/route.ts` - Execution preparation

### UI
- `src/app/page.tsx` - Main dashboard
- `src/components/ConnectBar.tsx` - Wallet connection

### Configuration
- `.env.local` - Environment variables
- `src/lib/constants.ts` - Network/token constants
- `src/lib/types.ts` - TypeScript types

---

## 🎯 Priority Order

### Must Do Before Testnet Demo
1. ✅ Fix `FACILITATOR_BASE_URL` (critical)
2. ✅ Verify router address and liquidity
3. ✅ Obtain testnet USDC.e tokens
4. ✅ Test x402 payment flow end-to-end
5. ✅ Test on-chain execution
6. ✅ Deploy to Vercel

### Should Do
7. Test all failure modes
8. Verify explorer links work
9. Test on mobile
10. Add better error messages

### Nice to Have
11. Add transaction monitoring
12. Implement analytics
13. Write tests

---

## 🚨 Known Issues / Gotchas

1. **Facilitator URL**: Currently set to `localhost:3000` - MUST change for production
2. **Router Liquidity**: Testnet may have limited liquidity - test small amounts first
3. **Token Faucets**: May need to request testnet tokens from Cronos team
4. **Gas Costs**: Ensure wallet has enough TCRO for gas
5. **Network Switching**: Some wallets may not auto-switch - user must manually switch
6. **EIP-712 Support**: Ensure wallet supports EIP-712 signatures (MetaMask does)

---

## ✅ Success Criteria

Your app is **fully operational on testnet** when:

- [ ] User can connect wallet and switch to Cronos testnet
- [ ] Preflight checks pass (facilitator + RPC + route discovery)
- [ ] x402 payment flow completes (requirements → sign → verify → settle)
- [ ] On-chain execution works (approve + swap)
- [ ] Receipts show all required data (tx hashes, balances, links)
- [ ] Explorer links are clickable and valid
- [ ] Run history persists and is selectable
- [ ] All failure modes are handled gracefully
- [ ] App is deployed and accessible via public URL

---

## 📞 Support Resources

- **Cronos Docs**: https://docs.cronos.org
- **x402 Facilitator API**: https://docs.cronos.org/cronos-x402-facilitator/api-reference
- **Cronos Testnet Explorer**: https://explorer.cronos.org/testnet
- **VVS Finance**: https://vvs.finance (for liquidity info)

---

**Last Updated**: 2026-01-21
**Version**: 1.0
**Status**: Ready for testnet deployment after addressing critical items
