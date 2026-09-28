import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC-SHA256 of the raw webhook body. Header value is `sha256=<hex>`. */
export function signWebhookPayload(secret: string, payload: string | Uint8Array): string {
  const data = typeof payload === "string" ? Buffer.from(payload) : Buffer.from(payload);
  return `sha256=${createHmac("sha256", secret).update(data).digest("hex")}`;
}

/**
 * Verify `x-cooper-signature` against the raw request body.
 * Returns false when the header is missing or does not match. Does not throw.
 */
export function verifyWebhookSignature(options: {
  secret: string;
  payload: string | Uint8Array;
  signature: string | null | undefined;
}): boolean {
  const header = options.signature?.trim();
  if (!header || !options.secret) return false;
  const expected = Buffer.from(signWebhookPayload(options.secret, options.payload));
  const actual = Buffer.from(header);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function signatureFromHeaders(
  headers: Headers | Record<string, string | null | undefined>,
): string | null {
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get("x-cooper-signature");
  }
  const record = headers as Record<string, string | null | undefined>;
  return record["x-cooper-signature"] ?? record["X-Cooper-Signature"] ?? null;
}
