import { describe, expect, it } from "vitest";

import { type BenchmarkTask } from "../domain/types";
import { selectStratifiedSample } from "./stratified-sample";

const buildTasks = (siteSizes: Record<string, number>): BenchmarkTask[] =>
  Object.entries(siteSizes).flatMap(([siteName, size]) =>
    Array.from({ length: size }, (_unused, index) => ({
      taskId: `${siteName}--${index}`,
      siteName: siteName,
      instruction: `do thing ${index}`,
      startUrl: `https://${siteName.toLowerCase()}.example`,
    })),
  );

const countBySite = (tasks: BenchmarkTask[]): Record<string, number> =>
  tasks.reduce<Record<string, number>>((counts, task) => {
    counts[task.siteName] = (counts[task.siteName] ?? 0) + 1;
    return counts;
  }, {});

const taskIds = (tasks: BenchmarkTask[]): string[] => tasks.map((task) => task.taskId);

describe("selectStratifiedSample", () => {
  it("returns the same tasks for the same seed", () => {
    const tasks = buildTasks({ Alpha: 40, Beta: 30, Gamma: 30 });

    const first = selectStratifiedSample({ tasks: tasks, sampleSize: 20, seed: 7 });
    const second = selectStratifiedSample({ tasks: tasks, sampleSize: 20, seed: 7 });

    expect(taskIds(first)).toEqual(taskIds(second));
  });

  it("returns different tasks for a different seed", () => {
    const tasks = buildTasks({ Alpha: 40, Beta: 30, Gamma: 30 });

    const seven = selectStratifiedSample({ tasks: tasks, sampleSize: 20, seed: 7 });
    const eight = selectStratifiedSample({ tasks: tasks, sampleSize: 20, seed: 8 });

    expect(taskIds(seven)).not.toEqual(taskIds(eight));
  });

  it("keeps each site's share of the sample", () => {
    const tasks = buildTasks({ Alpha: 50, Beta: 30, Gamma: 20 });

    const sample = selectStratifiedSample({ tasks: tasks, sampleSize: 10, seed: 1 });

    expect(countBySite(sample)).toEqual({ Alpha: 5, Beta: 3, Gamma: 2 });
  });

  it("fills exactly the requested count when shares do not divide evenly", () => {
    const tasks = buildTasks({ Alpha: 7, Beta: 7, Gamma: 7 });

    const sample = selectStratifiedSample({ tasks: tasks, sampleSize: 10, seed: 3 });

    expect(sample).toHaveLength(10);
  });

  it("never draws more from a site than it has", () => {
    const tasks = buildTasks({ Alpha: 90, Beta: 1 });

    const sample = selectStratifiedSample({ tasks: tasks, sampleSize: 80, seed: 5 });

    expect(countBySite(sample).Beta ?? 0).toBeLessThanOrEqual(1);
    expect(sample).toHaveLength(80);
  });

  it("returns every task when the sample is not smaller than the set", () => {
    const tasks = buildTasks({ Alpha: 3, Beta: 2 });

    expect(selectStratifiedSample({ tasks: tasks, sampleSize: 5, seed: 1 })).toHaveLength(5);
    expect(selectStratifiedSample({ tasks: tasks, sampleSize: 99, seed: 1 })).toHaveLength(5);
  });

  it("orders the sample by task id so a run's order never depends on the draw", () => {
    const tasks = buildTasks({ Alpha: 20, Beta: 20 });

    const sample = selectStratifiedSample({ tasks: tasks, sampleSize: 8, seed: 11 });

    expect(taskIds(sample)).toEqual([...taskIds(sample)].sort());
  });

  it("rejects a sample size that is not a positive whole number", () => {
    const tasks = buildTasks({ Alpha: 5 });

    expect(() => selectStratifiedSample({ tasks: tasks, sampleSize: 0, seed: 1 })).toThrow(
      /positive whole number/,
    );
    expect(() => selectStratifiedSample({ tasks: tasks, sampleSize: 2.5, seed: 1 })).toThrow(
      /positive whole number/,
    );
  });
});
