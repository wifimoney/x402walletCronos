import type { CronosNetwork } from "./types";

export const CRONOS_NETWORK = (process.env.NEXT_PUBLIC_CRONOS_NETWORK ??
  "cronos-testnet") as CronosNetwork;

export const CRONOS_RPC_URL =
  process.env.CRONOS_RPC_URL ?? "https://evm-t3.cronos.org";

export const FACILITATOR_BASE_URL =
  process.env.FACILITATOR_BASE_URL ?? "https://facilitator.cronoslabs.org";

export const SELLER_ADDRESS = (process.env.SELLER_ADDRESS ??
  "") as `0x${string}`;

// From Cronos facilitator API reference (USDC.e addresses + chain ids).
export const USDC_E: Record<CronosNetwork, `0x${string}`> = {
  "cronos-testnet": "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0",
  "cronos-mainnet": "0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C",
};

export const CHAIN_ID: Record<CronosNetwork, number> = {
  "cronos-testnet": 338,
  "cronos-mainnet": 25,
};