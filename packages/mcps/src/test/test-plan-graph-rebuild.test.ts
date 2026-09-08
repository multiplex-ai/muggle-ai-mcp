/**
 * Tests for the muggle-remote-test-plan-graph-rebuild tool, which queues a full
 * rebuild of a project's test-plan dependency graph so prerequisite edges the
 * incremental analysis cannot add are re-derived.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("../shared/config.js", () => ({
  getConfig: () => ({
    logLevel: "silent",
    serverName: "test",
    serverVersion: "0.0.0",
    e2e: {
      promptServiceBaseUrl: "http://test.invalid",
      requestTimeoutMs: 1000,
      workflowTimeoutMs: 5000,
    },
  }),
}));

vi.mock("../shared/logger.js", () => {
  const noop = () => undefined;
  const fakeLogger = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    verbose: noop,
    silly: noop,
    child: () => fakeLogger,
  };
  return {
    getLogger: () => fakeLogger,
    createChildLogger: () => fakeLogger,
    resetLogger: noop,
  };
});

vi.mock("../mcp/e2e/upstream-client.js", () => ({
  getPromptServiceClient: () => ({ execute: vi.fn() }),
}));

vi.mock("../shared/auth.js", () => ({
  getCallerCredentialsAsync: vi.fn(async () => ({ bearerToken: "test-token" })),
}));

import { TestPlanGraphRebuildInputSchema } from "../mcp/e2e/contracts/index.js";
import { getQaToolByName } from "../mcp/tools/e2e/tool-registry.js";

const PROJECT_ID = "44444444-4444-4444-8444-444444444444";

describe("muggle-remote-test-plan-graph-rebuild", () => {
  it("is registered and requires auth by default", () => {
    const tool = getQaToolByName("muggle-remote-test-plan-graph-rebuild");
    expect(tool).toBeDefined();
    expect(tool!.requiresAuth).not.toBe(false);
  });

  it("maps to the project's test-plan-graph rebuild POST endpoint", () => {
    const tool = getQaToolByName("muggle-remote-test-plan-graph-rebuild")!;
    const call = tool.mapToUpstream({ projectId: PROJECT_ID });
    expect(call.method).toBe("POST");
    expect(call.path).toBe(
      `/v1/protected/muggle-test/projects/${PROJECT_ID}/test-plan-graph/rebuild`,
    );
  });

  // The rebuild is addressed entirely by its path, so a body would be the kind of
  // detail an upstream schema later rejects.
  it("sends no request body", () => {
    const tool = getQaToolByName("muggle-remote-test-plan-graph-rebuild")!;
    expect(tool.mapToUpstream({ projectId: PROJECT_ID }).body).toBeUndefined();
  });

  it("rejects a non-UUID projectId", () => {
    expect(() => TestPlanGraphRebuildInputSchema.parse({ projectId: "not-a-uuid" })).toThrow();
  });

  it("requires a projectId", () => {
    expect(() => TestPlanGraphRebuildInputSchema.parse({})).toThrow();
  });

  // Callers routinely mistake the acknowledgement for the finished graph, so the
  // description has to say that it queues and returns a runtime id, not a graph.
  it("tells the caller the rebuild is only queued", () => {
    const tool = getQaToolByName("muggle-remote-test-plan-graph-rebuild")!;
    expect(tool.description).toMatch(/QUEUED/);
    expect(tool.description).toContain("workflowRuntimeId");
  });
});