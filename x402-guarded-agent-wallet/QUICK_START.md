# 🚀 Quick Start - Next 5 Steps to Testnet

## ⚡ Immediate Actions (30 minutes)

### 1. Fix Environment Variables (5 min)

Update `.env.local`:

```bash
# Change this line:
FACILITATOR_BASE_URL=http://localhost:3000

# To this:
FACILITATOR_BASE_URL=https://facilitator.cronoslabs.org
```

**Verify it works:**
```bash
curl https://facilitator.cronoslabs.org/healthcheck
# Expected: {"status": "success"}
```

---

### 2. Verify Router & Tokens (10 min)

Test that the router and tokens are configured correctly:

```bash
# Set variables
export RPC="https://evm-t3.cronos.org"
export ROUTER="0x2fFA3085D833C5c9ec6cdCF08480F53F33a1D42a"
export USDC_E="0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0"
export WCRO="0x6a3173618859C7cd8452b20fb5deAB01d4D64006"

# Test router (requires cast from foundry)
cast call $ROUTER "getAmountsOut(uint256,address[])(uint256[])" \
  10000000 "[$USDC_E,$WCRO]" \
  --rpc-url $RPC

# If you don't have cast, skip this - we'll test via the app
```

**If the router call fails:**
- The router address may be wrong
- There may be no liquidity on testnet
- You may need to use a different DEX

---

### 3. Get Testnet Tokens (5 min)

You need:
- **TCRO** (for gas) - Get from Cronos testnet faucet
- **USDC.e** (for swaps) - May need to request from Cronos team or find a testnet faucet

**Testnet Faucet:**
- Visit: https://cronos.org/faucet (or check Cronos Discord)
- Request TCRO for your wallet
- Check if USDC.e faucet exists, or ask in Cronos Discord

**Minimum amounts:**
- 1 TCRO (for gas)
- 11 USDC.e (10 for swap + 1 for agent fee)

---

### 4. Test Locally (5 min)

```bash
npm run dev
```

Open http://localhost:3000

**Quick Test:**
1. Connect wallet (MetaMask)
2. Switch to Cronos Testnet (Chain ID 338)
3. Enter prompt: "Swap 10 USDC.e to WCRO"
4. Click "1. Run Preflight"
5. Check if preflight passes

**Expected Results:**
- ✅ Facilitator health: OK
- ✅ RPC health: OK
- ✅ Route found: expectedOut > 0

**If preflight fails:**
- Check facilitator URL is correct
- Verify router has liquidity
- Check RPC is accessible

---

### 5. Deploy to Vercel (5 min)

```bash
# 1. Commit your changes
git add .
git commit -m "Update facilitator URL for testnet"
git push

# 2. Go to vercel.com
# 3. Import your GitHub repo
# 4. Add environment variables (copy from .env.local)
# 5. Deploy
```

**Environment Variables to Add in Vercel:**
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

---

## 🧪 Full Test Flow (2 minutes)

Once deployed and you have testnet tokens:

1. **Connect Wallet**
   - Open your deployed app
   - Click "Connect Wallet"
   - Approve MetaMask connection
   - Ensure you're on Cronos Testnet (338)

2. **Run Preflight**
   - Enter: "Swap 10 USDC.e to WCRO"
   - Click "1. Run Preflight"
   - Wait ~3 seconds
   - Verify: Policy ✅, Preflight ✅, Quote shows expectedOut

3. **Pay Agent Fee (x402)**
   - Click "2. Pay (x402)"
   - Sign EIP-712 message in MetaMask
   - Wait ~10 seconds for settlement
   - Verify: Button changes to "2. Paid ✅"

4. **Execute Swap**
   - Click "3. Execute Swap"
   - Approve USDC.e (if first time) - sign in MetaMask
   - Wait ~5 seconds
   - Sign swap transaction in MetaMask
   - Wait ~5 seconds
   - Verify: Receipt shows both tx hashes + explorer links

5. **Verify on Explorer**
   - Click the swap tx link
   - Should open: https://explorer.cronos.org/testnet/tx/{hash}
   - Verify transaction is successful

---

## 🚨 Troubleshooting

### "Facilitator health check failed"
- Check `FACILITATOR_BASE_URL` is correct
- Verify facilitator is online: `curl https://facilitator.cronoslabs.org/healthcheck`
- Check your internet connection

### "No route found"
- Router may not have liquidity for USDC.e → WCRO
- Try a smaller amount (e.g., "Swap 1 USDC.e to WCRO")
- Verify router address is correct
- Check if you need to use a different DEX

### "Payment verification failed"
- Ensure you signed the EIP-712 message correctly
- Check wallet has enough USDC.e for the fee (1 USDC.e)
- Verify facilitator supports cronos-testnet
- Check network is Cronos Testnet (338)

### "Transaction reverted"
- Ensure you have enough TCRO for gas
- Check allowance was approved
- Verify slippage isn't too tight (default is 0.5%)
- Check deadline hasn't expired (60s default)

### "Wallet not connecting"
- Add Cronos Testnet to MetaMask manually:
  - Network Name: Cronos Testnet
  - RPC URL: https://evm-t3.cronos.org
  - Chain ID: 338
  - Currency Symbol: TCRO
  - Block Explorer: https://explorer.cronos.org/testnet

---

## 📊 Success Checklist

After completing the 5 steps above, you should have:

- [x] Facilitator URL updated
- [x] Router and tokens verified
- [x] Testnet tokens in wallet
- [x] App running locally with successful preflight
- [x] App deployed to Vercel
- [ ] Full end-to-end test completed (preflight → pay → execute)
- [ ] Transaction visible on Cronos testnet explorer

---

## 📞 Need Help?

- **Full Checklist**: See `TESTNET_DEPLOYMENT_CHECKLIST.md`
- **Cronos Docs**: https://docs.cronos.org
- **x402 Docs**: https://docs.cronos.org/cronos-x402-facilitator
- **Discord**: Cronos Discord (for testnet tokens)

---

**Next**: Once you complete these 5 steps, run the full test flow and verify everything works end-to-end!
