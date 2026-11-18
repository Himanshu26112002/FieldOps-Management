import { authErrorMessage } from "./auth";

function errorCode(error: unknown): string {
  return typeof error === "object" && error && "code" in error ? String(error.code) : "";
}

/** True for network-level failures that are worth retrying rather than treating as a denial. */
export function isTransientError(error: unknown): boolean {
  return ["unavailable", "deadline-exceeded", "auth/network-request-failed"].includes(errorCode(error));
}

/**
 * Maps Firebase errors to plain English for display. Our own thrown Errors already carry
 * readable messages and pass through; raw rule-evaluation text is never shown.
 */
export function friendlyError(error: unknown, fallback = "Something went wrong. Try again."): string {
  const code = errorCode(error);
  if (code.startsWith("auth/")) return authErrorMessage(error);
  switch (code) {
    case "permission-denied":
      return "You do not have permission to do that, or the record has changed. Refresh and try again.";
    case "unavailable":
    case "deadline-exceeded":
      return "Network error. Check your connection and try again.";
    case "not-found":
      return "The record no longer exists. Refresh and try again.";
    case "failed-precondition":
      return "The database is not ready for this request (a Firestore index may still be building). Try again shortly.";
    case "resource-exhausted":
      return "The daily database quota has been reached. Try again later.";
    case "unauthenticated":
      return "Your session has expired. Sign in again.";
    case "":
      break;
    default:
      return fallback;
  }
  if (!(error instanceof Error)) return fallback;
  if (/PERMISSION_DENIED|evaluation error|Missing or insufficient permissions/i.test(error.message)) {
    return "You do not have permission to do that, or the record has changed. Refresh and try again.";
  }
  return error.message || fallback;
}
