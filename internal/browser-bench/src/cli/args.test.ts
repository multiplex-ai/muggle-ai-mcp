import { describe, expect, it } from "vitest";
import { DEFAULT_CONCURRENCY, MAX_STEPS_PER_TASK } from "../domain/constants";
import { parseCliArgs } from "./args";

const parse = (argv: string[]) =>
  parseCliArgs({
    argv: argv,
    defaultTasksPath: "/defaults/webvoyager-smoke.jsonl",
    defaultOutDir: "/defaults/reports",
  });

describe("parseCliArgs", () => {
  it("falls back to the injected defaults when no flags are given", () => {
    expect(parse([])).toEqual({
      tasksPath: "/defaults/webvoyager-smoke.jsonl",
      concurrency: DEFAULT_CONCURRENCY,
      outDir: "/defaults/reports",
      resume: false,
      maxSteps: MAX_STEPS_PER_TASK,
    });
  });

  it("reads every value flag", () => {
    expect(
      parse(["--tasks", "/tmp/all.jsonl", "--limit", "5", "--concurrency", "4", "--out", "/tmp/run"]),
    ).toEqual({
      tasksPath: "/tmp/all.jsonl",
      taskLimit: 5,
      concurrency: 4,
      outDir: "/tmp/run",
      resume: false,
      maxSteps: MAX_STEPS_PER_TASK,
    });
  });

  it("treats --resume as a switch that takes no value", () => {
    expect(parse(["--resume", "--limit", "2"])).toMatchObject({ resume: true, taskLimit: 2 });
  });

  it("leaves the limit absent so the whole task file runs", () => {
    expect(parse([])).not.toHaveProperty("taskLimit");
  });

  it("rejects an unknown flag and names the accepted ones", () => {
    expect(() => parse(["--judge"])).toThrow(/Unknown flag --judge.*--tasks/s);
  });

  it("rejects a value flag with nothing after it", () => {
    expect(() => parse(["--tasks"])).toThrow(/--tasks needs a value/);
  });

  it("rejects a value flag swallowing the next flag as its value", () => {
    expect(() => parse(["--tasks", "--resume"])).toThrow(/--tasks needs a value/);
  });

  it("rejects a non-numeric count", () => {
    expect(() => parse(["--limit", "many"])).toThrow(/--limit needs a positive whole number/);
  });

  it("rejects a fractional count", () => {
    expect(() => parse(["--concurrency", "1.5"])).toThrow(/positive whole number/);
  });

  it("rejects a zero count", () => {
    expect(() => parse(["--concurrency", "0"])).toThrow(/positive whole number/);
  });
});

describe("step budget flag", () => {
  it("defaults to WebVoyager's own cap so results stay comparable", () => {
    expect(
      parseCliArgs({ argv: [], defaultTasksPath: "t.jsonl", defaultOutDir: "out" }).maxSteps,
    ).toBe(MAX_STEPS_PER_TASK);
  });

  it("accepts a raised budget, which the report then has to disclose", () => {
    expect(
      parseCliArgs({
        argv: ["--max-steps", "30"],
        defaultTasksPath: "t.jsonl",
        defaultOutDir: "out",
      }).maxSteps,
    ).toBe(30);
  });

  it("rejects a budget that is not a positive whole number", () => {
    expect(() =>
      parseCliArgs({ argv: ["--max-steps", "0"], defaultTasksPath: "t.jsonl", defaultOutDir: "out" }),
    ).toThrow(/max-steps/i);
  });
});
