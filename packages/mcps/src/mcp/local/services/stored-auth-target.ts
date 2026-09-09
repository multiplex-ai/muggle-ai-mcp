/**
 * Runtime target ownership of a stored auth session.
 */

import { RuntimeTarget } from "../../../shared/runtime-target-types.js";

/**
 * Decode a JWT's payload without verifying the signature.
 *
 * Used to extract claims for local consistency checks, not authentication decisions.
 * @param token - The JWT token string.
 * @returns The decoded payload, or null if the token cannot be decoded.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const payload = parts[1];
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extract the issuer from a JWT token's payload.
 *
 * @param token - The JWT token string.
 * @returns The issuer claim value, or null if it cannot be extracted.
 */
export function extractJwtIssuer(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.iss !== "string") {
    return null;
  }
  return payload.iss;
}

/**
 * Normalize an issuer URL for comparison by removing https:// prefix and trailing slash.
 *
 * @param issuer - The issuer URL from a JWT or Auth0 domain.
 * @returns Normalized issuer host (domain only).
 */
function normalizeIssuerHost(issuer: string): string {
  return issuer.replace(/^https:\/\//, "").replace(/\/$/, "");
}

/**
 * Decide whether a stored session may be used for the active runtime target.
 *
 * A session carrying no target predates targets being recorded, and can only be
 * a production one: every build able to write it pointed at production.
 *
 * Additionally, validates that the stored session's token issuer matches the expected
 * Auth0 domain for the active target. This prevents using tokens minted by a different
 * Auth0 tenant.
 *
 * @param params - Session ownership parameters.
 * @param params.storedRuntimeTarget - Target recorded on the session, if any.
 * @param params.activeRuntimeTarget - Target the harness is running as.
 * @param params.tokenIssuer - Issuer claim extracted from the access token, if available.
 * @param params.expectedAuth0Domain - The Auth0 domain configured for the active target.
 * @returns True when the session belongs to the active target and was issued by the correct tenant.
 */
export function isStoredAuthForRuntimeTarget(params: {
  storedRuntimeTarget?: RuntimeTarget;
  activeRuntimeTarget: RuntimeTarget;
  tokenIssuer?: string | null;
  expectedAuth0Domain?: string;
}): boolean {
  // Checked before the target comparison because it is independent of it: a session
  // whose target is absent or mis-stamped is exactly the case a foreign-tenant token
  // produces, so deferring this until after the target matches would skip it there.
  if (params.tokenIssuer && params.expectedAuth0Domain) {
    const issuerHost = normalizeIssuerHost(params.tokenIssuer);
    const expectedHost = normalizeIssuerHost(params.expectedAuth0Domain);
    if (issuerHost !== expectedHost) {
      return false;
    }
  }

  if (!params.storedRuntimeTarget) {
    return params.activeRuntimeTarget === RuntimeTarget.Production;
  }

  return params.storedRuntimeTarget === params.activeRuntimeTarget;
}
