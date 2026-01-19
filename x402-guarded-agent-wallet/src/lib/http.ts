export async function fetchJsonWithRetry<T>(
    url: string,
    init: RequestInit,
    opts?: { retries?: number; backoffMs?: number; timeoutMs?: number }
  ): Promise<{ data: T; ms: number }> {
    const retries = opts?.retries ?? 2;
    const backoffMs = opts?.backoffMs ?? 250;
    const timeoutMs = opts?.timeoutMs ?? 10_000;
  
    let lastErr: unknown;
  
    for (let attempt = 0; attempt <= retries; attempt++) {
      const started = Date.now();
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
  
      try {
        const res = await fetch(url, { ...init, signal: ctrl.signal });
        const ms = Date.now() - started;
        clearTimeout(t);
  
        const text = await res.text();
        const json = text ? JSON.parse(text) : null;
  
        if (!res.ok) {
          throw new Error(
            `HTTP ${res.status} ${res.statusText}: ${JSON.stringify(json)}`
          );
        }
  
        return { data: json as T, ms };
      } catch (e) {
        clearTimeout(t);
        lastErr = e;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
          continue;
        }
        throw lastErr;
      }
    }
  
    // unreachable
    throw lastErr;
  }