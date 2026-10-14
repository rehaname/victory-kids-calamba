/** Shown when the database never answered. Cause codes stay in the server log. */
export const SUPABASE_UNREACHABLE =
  "Supabase is unreachable right now. Nothing was saved. Wait a minute and refresh. Do not change Vercel environment variables.";

const FETCH_CAUSE_CODES = new Set([
  "ENOTFOUND",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

type CauseInfo = { code: string | null; message: string | null };

function readCause(err: unknown): CauseInfo | null {
  if (!err || typeof err !== "object" || !("cause" in err)) return null;
  const cause = (err as { cause?: unknown }).cause;
  if (typeof cause === "string") return { code: null, message: cause };
  if (!cause || typeof cause !== "object") return null;
  const code =
    "code" in cause && typeof (cause as { code?: unknown }).code === "string"
      ? (cause as { code: string }).code
      : null;
  const message =
    "message" in cause && typeof (cause as { message?: unknown }).message === "string"
      ? (cause as { message: string }).message
      : null;
  if (!code && !message) return null;
  return { code, message };
}

export function isFetchFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (/fetch failed/i.test(message)) return true;
  const cause = readCause(err);
  if (cause?.code && FETCH_CAUSE_CODES.has(cause.code)) return true;
  if (cause?.message && /fetch failed/i.test(cause.message)) return true;
  return false;
}

/** Turn unknown thrown values (incl. PostgrestError) into a real Error. */
export function toError(err: unknown, fallback = "Something went wrong"): Error {
  if (err instanceof Error) return err;
  if (typeof err === "object" && err && "message" in err) {
    const message = String((err as { message: unknown }).message || fallback);
    return new Error(message || fallback);
  }
  if (typeof err === "string" && err.trim()) return new Error(err);
  return new Error(fallback);
}

/** Church-facing text. Fetch failures become one sentence; the cause chain is not included. */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (isFetchFailure(err)) return SUPABASE_UNREACHABLE;
  return toError(err, fallback).message;
}

/** Server log: message plus the cause code and message. Not shown in the UI. */
export function logServerError(label: string, err: unknown): void {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "unknown";
  const cause = readCause(err);
  console.error(label, {
    message,
    causeCode: cause?.code ?? null,
    causeMessage: cause?.message ?? null,
  });
}
