/**
 * Wrapper around the global `fetch` that enforces a timeout via AbortController.
 *
 * Why this matters: without a timeout, a slow third-party API can hang a
 * request handler indefinitely. In Node that keeps an event-loop slot
 * occupied; in production that's a slow-drip resource leak. The default is
 * "never time out" which is almost always wrong for server-to-server calls.
 *
 * We also merge an optional caller-provided AbortSignal with our timeout
 * signal, so higher-level cancellation (e.g. client disconnected) still
 * aborts the in-flight call.
 */

export async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 15_000, signal: outerSignal, ...init } = opts;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)),
    timeoutMs
  );

  // If the caller already supplied a signal, abort our controller when it fires.
  const onOuterAbort = () => controller.abort(outerSignal?.reason);
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort(outerSignal.reason);
    else outerSignal.addEventListener('abort', onOuterAbort, { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    if (outerSignal) outerSignal.removeEventListener('abort', onOuterAbort);
  }
}
