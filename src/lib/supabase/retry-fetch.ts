const DEFAULT_BACKOFF_MS = [400, 1200];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries only when fetch throws (no HTTP response).
 * Two retries: about 400ms, then about 1200ms. HTTP 4xx/5xx are returned as-is.
 */
export function createRetryFetch(
  baseFetch: typeof fetch = fetch,
  backoffMs: readonly number[] = DEFAULT_BACKOFF_MS,
): typeof fetch {
  const retryFetch: typeof fetch = async (input, init) => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
      try {
        return await baseFetch(input, init);
      } catch (err) {
        lastError = err;
        const delay = backoffMs[attempt];
        if (delay == null) break;
        await sleep(delay);
      }
    }
    throw lastError;
  };
  return retryFetch;
}

export const fetchWithRetry = createRetryFetch();
