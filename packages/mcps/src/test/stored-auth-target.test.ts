import { describe, expect, it } from "vitest";

import { RuntimeTarget } from "../shared/runtime-target-types.js";
import {
  decodeJwtPayload,
  extractJwtIssuer,
  isStoredAuthForRuntimeTarget,
} from "../mcp/local/services/stored-auth-target.js";

/**
 * Create a mock JWT token with the given issuer claim.
 * @param iss - The issuer value to encode.
 * @returns A JWT-shaped token string (no signature validation).
 */
function createMockJwt(iss: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss, sub: "user123", aud: "test" })).toString("base64url");
  const signature = "mock_signature";
  return `${header}.${payload}.${signature}`;
}

describe("JWT decoding utilities", () => {
  describe("decodeJwtPayload", () => {
    it("decodes a valid JWT payload", () => {
      const token = createMockJwt("https://login.muggle-ai.com/");
      const payload = decodeJwtPayload(token);
      expect(payload).not.toBeNull();
      expect(payload?.iss).toBe("https://login.muggle-ai.com/");
    });

    it("returns null for an invalid token (wrong part count)", () => {
      const invalidToken = "invalid.token";
      const payload = decodeJwtPayload(invalidToken);
      expect(payload).toBeNull();
    });

    it("returns null for malformed base64url payload", () => {
      const invalidToken = "header.!!!invalid!!!.signature";
      const payload = decodeJwtPayload(invalidToken);
      expect(payload).toBeNull();
    });

    it("returns null for invalid JSON in payload", () => {
      const header = "header";
      const invalidPayload = Buffer.from("not valid json").toString("base64url");
      const invalidToken = `${header}.${invalidPayload}.signature`;
      const payload = decodeJwtPayload(invalidToken);
      expect(payload).toBeNull();
    });
  });

  describe("extractJwtIssuer", () => {
    it("extracts the issuer from a valid JWT", () => {
      const token = createMockJwt("https://login.muggle-ai.com/");
      const issuer = extractJwtIssuer(token);
      expect(issuer).toBe("https://login.muggle-ai.com/");
    });

    it("returns null when the token is invalid", () => {
      const issuer = extractJwtIssuer("invalid.token");
      expect(issuer).toBeNull();
    });

    it("returns null when the issuer claim is missing", () => {
      const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ sub: "user123" })).toString("base64url");
      const token = `${header}.${payload}.signature`;
      const issuer = extractJwtIssuer(token);
      expect(issuer).toBeNull();
    });

    it("returns null when the issuer claim is not a string", () => {
      const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ iss: 12345 })).toString("base64url");
      const token = `${header}.${payload}.signature`;
      const issuer = extractJwtIssuer(token);
      expect(issuer).toBeNull();
    });
  });
});

describe("isStoredAuthForRuntimeTarget", () => {
  const productionDomain = "login.muggle-ai.com";
  const stagingDomain = "login.staging.muggle-ai.com";

  it("accepts a session with no recorded target on production", () => {
    const result = isStoredAuthForRuntimeTarget({
      storedRuntimeTarget: undefined,
      activeRuntimeTarget: RuntimeTarget.Production,
    });
    expect(result).toBe(true);
  });

  it("rejects a session with no recorded target on staging", () => {
    const result = isStoredAuthForRuntimeTarget({
      storedRuntimeTarget: undefined,
      activeRuntimeTarget: RuntimeTarget.Staging,
    });
    expect(result).toBe(false);
  });

  it("accepts a matching target without issuer validation", () => {
    const result = isStoredAuthForRuntimeTarget({
      storedRuntimeTarget: RuntimeTarget.Production,
      activeRuntimeTarget: RuntimeTarget.Production,
    });
    expect(result).toBe(true);
  });

  it("rejects a mismatched target regardless of issuer", () => {
    const token = createMockJwt("https://login.muggle-ai.com/");
    const issuer = extractJwtIssuer(token);
    const result = isStoredAuthForRuntimeTarget({
      storedRuntimeTarget: RuntimeTarget.Production,
      activeRuntimeTarget: RuntimeTarget.Staging,
      tokenIssuer: issuer,
      expectedAuth0Domain: stagingDomain,
    });
    expect(result).toBe(false);
  });

  it("accepts a matching target with matching issuer", () => {
    const token = createMockJwt("https://login.muggle-ai.com/");
    const issuer = extractJwtIssuer(token);
    const result = isStoredAuthForRuntimeTarget({
      storedRuntimeTarget: RuntimeTarget.Production,
      activeRuntimeTarget: RuntimeTarget.Production,
      tokenIssuer: issuer,
      expectedAuth0Domain: productionDomain,
    });
    expect(result).toBe(true);
  });

  it("rejects a matching target with mismatched issuer", () => {
    const token = createMockJwt("https://login.staging.muggle-ai.com/");
    const issuer = extractJwtIssuer(token);
    const result = isStoredAuthForRuntimeTarget({
      storedRuntimeTarget: RuntimeTarget.Production,
      activeRuntimeTarget: RuntimeTarget.Production,
      tokenIssuer: issuer,
      expectedAuth0Domain: productionDomain,
    });
    expect(result).toBe(false);
  });

  it("normalizes issuer URL by removing https:// and trailing slash", () => {
    const token = createMockJwt("https://login.muggle-ai.com/");
    const issuer = extractJwtIssuer(token);
    const result = isStoredAuthForRuntimeTarget({
      storedRuntimeTarget: RuntimeTarget.Production,
      activeRuntimeTarget: RuntimeTarget.Production,
      tokenIssuer: issuer,
      expectedAuth0Domain: "login.muggle-ai.com",
    });
    expect(result).toBe(true);
  });

  it("accepts matching target when token issuer is absent (no rejection on missing info)", () => {
    const result = isStoredAuthForRuntimeTarget({
      storedRuntimeTarget: RuntimeTarget.Production,
      activeRuntimeTarget: RuntimeTarget.Production,
      tokenIssuer: null,
      expectedAuth0Domain: productionDomain,
    });
    expect(result).toBe(true);
  });

  it("accepts matching target when expected domain is absent (no rejection on missing info)", () => {
    const token = createMockJwt("https://login.muggle-ai.com/");
    const issuer = extractJwtIssuer(token);
    const result = isStoredAuthForRuntimeTarget({
      storedRuntimeTarget: RuntimeTarget.Production,
      activeRuntimeTarget: RuntimeTarget.Production,
      tokenIssuer: issuer,
      expectedAuth0Domain: undefined,
    });
    expect(result).toBe(true);
  });

  it("detects issuer mismatch for staging token on production", () => {
    const token = createMockJwt("https://login.staging.muggle-ai.com/");
    const issuer = extractJwtIssuer(token);
    const result = isStoredAuthForRuntimeTarget({
      storedRuntimeTarget: RuntimeTarget.Production,
      activeRuntimeTarget: RuntimeTarget.Production,
      tokenIssuer: issuer,
      expectedAuth0Domain: productionDomain,
    });
    expect(result).toBe(false);
  });

  it("handles issuer without https:// prefix", () => {
    const token = createMockJwt("login.muggle-ai.com/");
    const issuer = extractJwtIssuer(token);
    const result = isStoredAuthForRuntimeTarget({
      storedRuntimeTarget: RuntimeTarget.Production,
      activeRuntimeTarget: RuntimeTarget.Production,
      tokenIssuer: issuer,
      expectedAuth0Domain: "https://login.muggle-ai.com",
    });
    expect(result).toBe(true);
  });
  it("rejects an untargeted session whose token came from another tenant", () => {
    const token = createMockJwt("https://login.staging.muggle-ai.com/");
    const result = isStoredAuthForRuntimeTarget({
      storedRuntimeTarget: undefined,
      activeRuntimeTarget: RuntimeTarget.Production,
      tokenIssuer: extractJwtIssuer(token),
      expectedAuth0Domain: "https://login.muggle-ai.com/",
    });
    expect(result).toBe(false);
  });

  it("still accepts an untargeted session when its issuer matches", () => {
    const token = createMockJwt("https://login.muggle-ai.com/");
    const result = isStoredAuthForRuntimeTarget({
      storedRuntimeTarget: undefined,
      activeRuntimeTarget: RuntimeTarget.Production,
      tokenIssuer: extractJwtIssuer(token),
      expectedAuth0Domain: "https://login.muggle-ai.com/",
    });
    expect(result).toBe(true);
  });

  it("still accepts an untargeted session when no issuer can be read", () => {
    const result = isStoredAuthForRuntimeTarget({
      storedRuntimeTarget: undefined,
      activeRuntimeTarget: RuntimeTarget.Production,
      tokenIssuer: null,
      expectedAuth0Domain: "https://login.muggle-ai.com/",
    });
    expect(result).toBe(true);
  });
});
