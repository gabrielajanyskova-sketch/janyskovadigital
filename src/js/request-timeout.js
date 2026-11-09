// AbortController also works in browsers without AbortSignal.timeout (Safari 14–15).
export async function withTimeout(milliseconds, operation) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, milliseconds);
  try {
    const result = await operation(controller.signal);
    if (timedOut) throw new DOMException('Request timed out', 'TimeoutError');
    return result;
  } catch (error) {
    if (timedOut) throw new DOMException('Request timed out', 'TimeoutError');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
