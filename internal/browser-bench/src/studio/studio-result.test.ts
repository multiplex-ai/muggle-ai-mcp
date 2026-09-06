import { describe, expect, it } from "vitest";
import { BenchmarkOutcome } from "../domain/types";
import { parseStudioResult, toTaskResult } from "./studio-result";
import { type StudioResultFile } from "./types";

const studioResult = (overrides: Partial<StudioResultFile> = {}): StudioResultFile => ({
  taskId: "Allrecipes--0",
  finalAnswer: "Vegetarian lasagna, 4.6 stars.",
  studioStatus: "success",
  stepCount: 7,
  durationMs: 41_230,
  trajectoryDir: "/out/trajectories/Allrecipes--0",
  ...overrides,
});

describe("parseStudioResult", () => {
  it("reads a well-formed result file", () => {
    expect(
      parseStudioResult({
        jsonContent: JSON.stringify(studioResult()),
        expectedTaskId: "Allrecipes--0",
      }),
    ).toEqual(studioResult());
  });

  it("rejects a result written for a different task", () => {
    expect(() =>
      parseStudioResult({
        jsonContent: JSON.stringify(studioResult({ taskId: "Amazon--0" })),
        expectedTaskId: "Allrecipes--0",
      }),
    ).toThrow(/reports task Amazon--0 but Allrecipes--0 was requested/);
  });

  it("names a missing field", () => {
    const withoutStatus = JSON.stringify({ ...studioResult(), studioStatus: undefined });

    expect(() =>
      parseStudioResult({ jsonContent: withoutStatus, expectedTaskId: "Allrecipes--0" }),
    ).toThrow(/"studioStatus" must be a string/);
  });

  it("names a mistyped numeric field", () => {
    const stepCountAsText = JSON.stringify({ ...studioResult(), stepCount: "7" });

    expect(() =>
      parseStudioResult({ jsonContent: stepCountAsText, expectedTaskId: "Allrecipes--0" }),
    ).toThrow(/"stepCount" must be a number/);
  });

  it("names the task when the file is not JSON", () => {
    expect(() =>
      parseStudioResult({ jsonContent: "{truncated", expectedTaskId: "Allrecipes--0" }),
    ).toThrow(/Allrecipes--0 is not valid JSON/);
  });
});

describe("toTaskResult", () => {
  it("counts a success as a pass", () => {
    expect(toTaskResult(studioResult())).toEqual({
      taskId: "Allrecipes--0",
      outcome: BenchmarkOutcome.Pass,
      finalAnswer: "Vegetarian lasagna, 4.6 stars.",
      studioStatus: "success",
      stepCount: 7,
      durationMs: 41_230,
      tokensUsed: 0,
      trajectoryDir: "/out/trajectories/Allrecipes--0",
    });
  });

  it("counts any other studio status as a fail, never an error", () => {
    expect(toTaskResult(studioResult({ studioStatus: "max_steps_reached" })).outcome).toBe(
      BenchmarkOutcome.Fail,
    );
  });

  it("leaves the judge fields unset for the judging pass to fill", () => {
    const taskResult = toTaskResult(studioResult());

    expect(taskResult.judgeVerdict).toBeUndefined();
    expect(taskResult.judgeReasoning).toBeUndefined();
  });

  it("reports zero tokens because studio does not measure them yet", () => {
    expect(toTaskResult(studioResult()).tokensUsed).toBe(0);
  });
});

describe("token totals", () => {
  const withTokens = (extra: Record<string, unknown>) =>
    JSON.stringify({
      taskId: "Allrecipes--0",
      finalAnswer: "answer",
      studioStatus: "success",
      stepCount: 3,
      durationMs: 1000,
      trajectoryDir: "C:/out/t",
      ...extra,
    });

  it("carries the run's token spend onto the result", () => {
    const parsed = parseStudioResult({
      jsonContent: withTokens({ inputTokens: 900, outputTokens: 100, totalTokens: 1000 }),
      expectedTaskId: "Allrecipes--0",
    });

    expect(toTaskResult(parsed).tokensUsed).toBe(1000);
  });

  it("reads zero for a studio build that predates token reporting", () => {
    // Older studio builds write no token fields. Treating that as zero keeps a
    // mixed-build batch parseable; the report's total simply understates.
    const parsed = parseStudioResult({
      jsonContent: withTokens({}),
      expectedTaskId: "Allrecipes--0",
    });

    expect(toTaskResult(parsed).tokensUsed).toBe(0);
  });
});
