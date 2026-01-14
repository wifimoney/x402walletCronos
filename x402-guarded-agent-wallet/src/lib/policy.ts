import type { ActionIntent } from "./types";
import { CRONOS_NETWORK, USDC_E, WCRO } from "./constants";

const ZERO = ("0x" + "0".repeat(40)) as `0x${string}`;

export function evaluatePolicy(intent: ActionIntent, opts?: { dryRun?: boolean }) {
  const rules: string[] = [];
  let allowed = true;
  const now = Math.floor(Date.now() / 1000);

  // swap-only (MVP)
  if (intent.action !== "swap") {
    allowed = false;
    rules.push("DENY_action_not_swap");
  } else {
    rules.push("OK_action_swap");
  }

  // expiry (one-time envelope)
  if (intent.sessionExpiry < now) {
    allowed = false;
    rules.push("DENY_intent_expired");
  } else {
    rules.push("OK_intent_not_expired");
  }

  // tokenIn must be USDC.e for MVP
  if (intent.params.tokenIn.toLowerCase() !== USDC_E[CRONOS_NETWORK].toLowerCase()) {
    allowed = false;
    rules.push("DENY_tokenIn_not_USDCe");
  } else {
    rules.push("OK_tokenIn_USDCe");
  }

  // amount cap (25 USDC.e)
  // amountIn is base units 6 decimals
  const amountIn = BigInt(intent.params.amountIn);
  const cap = BigInt("25000000"); // 25 * 1e6
  if (amountIn > cap) {
    allowed = false;
    rules.push("DENY_amount_over_cap_25_USDCe");
  } else {
    rules.push("OK_amount_under_cap");
  }

  // slippage cap (2%)
  if (intent.params.maxSlippageBps > 200) {
    allowed = false;
    rules.push("DENY_slippage_over_2pct");
  } else {
    rules.push("OK_slippage_under_2pct");
  }

  // tokenOut safety: enforce only in real mode.
  // In dry-run, allow but warn so you can demo without configuring WCRO/testnet router.
  const tokenOut = intent.params.tokenOut;
  if (tokenOut === ZERO || tokenOut.toLowerCase() === WCRO[CRONOS_NETWORK].toLowerCase() && tokenOut === ZERO) {
    if (opts?.dryRun) {
      rules.push("WARN_tokenOut_unconfigured_dryrun_ok");
    } else {
      allowed = false;
      rules.push("DENY_tokenOut_unconfigured");
    }
  } else {
    rules.push("OK_tokenOut_configured");
  }

  return {
    allowed,
    rulesTriggered: rules,
    reason: allowed ? "Policy OK" : "Policy denied (see rulesTriggered)",
  };
}