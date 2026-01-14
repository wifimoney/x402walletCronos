export function encodePaymentHeaderClient(decoded: unknown): string {
    const json = JSON.stringify(decoded);
    // UTF-8 safe base64
    return btoa(unescape(encodeURIComponent(json)));
  }
  