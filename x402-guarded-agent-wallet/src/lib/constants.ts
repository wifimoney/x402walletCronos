import type { CronosNetwork } from "./types";

export const CRONOS_NETWORK = (process.env.NEXT_PUBLIC_CRONOS_NETWORK ??
  "cronos-testnet") as CronosNetwork;

export const CRONOS_RPC_URL =
  process.env.CRONOS_RPC_URL ?? "https://evm-t3.cronos.org";

export const FACILITATOR_BASE_URL =
  process.env.FACILITATOR_BASE_URL ?? "https://facilitator.cronoslabs.org";

export const SELLER_ADDRESS = (process.env.SELLER_ADDRESS ??
  "") as `0x${string}`;

export const ROUTER_ADDRESS = (process.env.ROUTER_ADDRESS ??
  "") as `0x${string}`;

// From Cronos facilitator API reference (USDC.e addresses + chain ids).  [oai_citation:2‡docs.cronos.org](https://docs.cronos.org/cronos-x402-facilitator/api-reference)
export const USDC_E: Record<CronosNetwork, `0x${string}`> = {
  "cronos-testnet": "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0",
  "cronos-mainnet": "0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C",
};

export const CHAIN_ID: Record<CronosNetwork, number> = {
  "cronos-testnet": 338,
  "cronos-mainnet": 25,
};

// Wrapped CRO addresses vary by network; use your preferred canonical WCRO.
// Mainnet WCRO commonly shown as 0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23.  [oai_citation:3‡explorer.cronos.org](https://explorer.cronos.org/address/0x5c7f8a570d578ed84e63fdfa7b1ee72deae1ae23?utm_source=chatgpt.com)
export const WCRO: Record<CronosNetwork, `0x${string}`> = {
  "cronos-mainnet": "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23",
  // For testnet, plug the WCRO you’re using (or swap to a testnet router/pair you know works).
  // If you don’t have one yet, leave tokenOut in the plan as CRO and skip quote until you set this.
  "cronos-testnet": "0x0000000000000000000000000000000000000000",
};