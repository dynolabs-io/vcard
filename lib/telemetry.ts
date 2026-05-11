// Best-effort crash + error telemetry. Every native-touching action
// wraps its call in `trace()`. Errors POST to /v1/crash with a stable
// label so we can correlate the user's report ("share crashed") with
// the actual stack server-side.
//
// Also installs a global JS error handler so uncaught errors don't
// silently disappear.

import { config } from './config';

type TraceCtx = Record<string, unknown>;

async function postCrash(payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${config.apiBase}/v1/crash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, ts: new Date().toISOString() }),
    });
  } catch { /* don't crash the crash logger */ }
}

/**
 * Runs `fn`. If it throws or rejects, POSTs the error + stack to
 * /v1/crash labelled with `where`, then re-throws so the caller's
 * own catch/Alert still fires.
 */
export async function trace<T>(where: string, ctx: TraceCtx, fn: () => Promise<T>): Promise<T> {
  await postCrash({ where, phase: 'start', ctx });
  try {
    const result = await fn();
    await postCrash({ where, phase: 'ok', ctx });
    return result;
  } catch (e) {
    await postCrash({
      where,
      phase: 'error',
      ctx,
      error: String(e),
      stack: (e as Error)?.stack,
      name: (e as Error)?.name,
    });
    throw e;
  }
}

let installed = false;

export function installGlobalErrorHandler(): void {
  if (installed) return;
  installed = true;
  // RN's global error handler — catches uncaught JS errors that would
  // otherwise show only a redbox/whitebox.
  const ErrorUtils = (globalThis as unknown as { ErrorUtils?: {
    getGlobalHandler: () => (e: Error, isFatal?: boolean) => void;
    setGlobalHandler: (h: (e: Error, isFatal?: boolean) => void) => void;
  }}).ErrorUtils;
  if (!ErrorUtils) return;
  const orig = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((e, isFatal) => {
    void postCrash({
      where: 'global',
      phase: 'uncaught',
      isFatal: Boolean(isFatal),
      error: String(e),
      stack: e?.stack,
      name: e?.name,
    });
    orig(e, isFatal);
  });
  // Unhandled promise rejections
  const proc = (globalThis as unknown as { process?: { on?: (e: string, f: (r: unknown) => void) => void }}).process;
  if (proc?.on) {
    proc.on('unhandledRejection', (reason) => {
      void postCrash({
        where: 'global',
        phase: 'unhandledRejection',
        error: String(reason),
        stack: (reason as Error)?.stack,
      });
    });
  }
}
