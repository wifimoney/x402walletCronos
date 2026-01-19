export type NetworkName = "cronos-testnet" | "cronos-mainnet";

export const NETWORK: NetworkName =
  (process.env.NETWORK as NetworkName) || "cronos-testnet";

export const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://facilitator.cronoslabs.org/v2/x402";

export const CHAIN = {
  "cronos-testnet": {
    chainId: 338,
    rpcUrl: process.env.CRONOS_RPC || "https://evm-t3.cronos.org",
    explorerBaseUrl: "https://cronos.org/explorer/testnet3",
  },
  "cronos-mainnet": {
    chainId: 25,
    rpcUrl: process.env.CRONOS_RPC || "https://evm.cronos.org",
    explorerBaseUrl: "https://cronoscan.com",
  },
} as const;

export const TOKEN = {
  USDCE: {
    testnet: process.env.USDCE_ADDRESS_TESTNET || "",
    mainnet: process.env.USDCE_ADDRESS_MAINNET || "",
    decimals: 6,
    symbol: "USDC.e",
  },
} as const;

export const ROUTERS = {
  VVS_MAINNET: process.env.VVS_ROUTER_MAINNET || "",
} as const;