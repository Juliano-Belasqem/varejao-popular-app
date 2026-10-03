/** A request that reached Meta can have succeeded even if its response was lost. */
export function publicationFailureDisposition(remoteAttempted: boolean): "reconcile" | "retryable-error" {
  return remoteAttempted ? "reconcile" : "retryable-error";
}
