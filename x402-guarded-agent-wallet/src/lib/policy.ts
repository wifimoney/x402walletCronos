import type { ActionIntent } from "./types";
import { CRONOS_NETWORK, USDC_E } from "./constants";

const ZERO = ("0x" + "0".repeat(40)) as `0x${string}`;

export function evaluatePolicy(intent: ActionIntent, opts?: { dryRun?: boolean }) {
  const rules: string[] = [];
  let allowed = true;
  const now = Math.floor(Date.now() / 1000);

  // transfer-only (Pivot for Reliability)
  if (intent.action !== "transfer") {
    allowed = false;
    rules.push("DENY_action_not_transfer");
  } else {
    rules.push("OK_action_transfer");
  }

  // expiry (one-time envelope)
  if (intent.sessionExpiry < now) {
    allowed = false;
    rules.push("DENY_intent_expired");
  } else {
    rules.push("OK_intent_not_expired");
  }

  // token must be USDC.e
  if (intent.params.token.toLowerCase() !== USDC_E[CRONOS_NETWORK].toLowerCase()) {
    allowed = false;
    rules.push("DENY_token_not_USDCe");
  } else {
    rules.push("OK_token_USDCe");
  }

  // amount cap (25 USDC.e)
  // amount is base units 6 decimals
  const amount = BigInt(intent.params.amount);
  const cap = BigInt("25000000"); // 25 * 1e6
  if (amount > cap) {
    allowed = false;
    rules.push("DENY_amount_over_cap_25_USDCe");
  } else {
    rules.push("OK_amount_under_cap");
  }

  // recipient check (basic sanity, e.g. not empty)
  if (!intent.params.to || intent.params.to === ZERO) {
    if (opts?.dryRun) {
      rules.push("WARN_recipient_zero_dryrun");
    } else {
      allowed = false;
      rules.push("DENY_recipient_zero");
    }
  } else {
    rules.push("OK_recipient_valid");
  }

  return {
    allowed,
    rulesTriggered: rules,
    reason: allowed ? "Policy OK" : "Policy denied (see rulesTriggered)",
  };
}