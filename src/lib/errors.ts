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

export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  return toError(err, fallback).message;
}
