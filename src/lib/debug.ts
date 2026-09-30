/**
 * Debug Mode — verbose server-side logging gated on DEBUG env var.
 *
 * Set DEBUG=true (or DEBUG=1) to log request/response details, DB queries,
 * and business-logic decisions (interest accrual, payment allocation, auth
 * checks) to the console. Disabled by default — a no-op in production
 * unless explicitly turned on.
 */

const isEnabled = process.env.DEBUG === "true" || process.env.DEBUG === "1";

export function debugLog(scope: string, message: string, data?: unknown): void {
  if (!isEnabled) return;
  const timestamp = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[DEBUG ${timestamp}] [${scope}] ${message}`, data);
  } else {
    console.log(`[DEBUG ${timestamp}] [${scope}] ${message}`);
  }
}

export const debugModeEnabled = isEnabled;
