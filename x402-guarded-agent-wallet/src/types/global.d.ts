export {};

declare global {
  interface Window {
    ethereum?: import("viem").EIP1193Provider;
  }
}