import { type BenchmarkTask } from "../domain/types";

/**
 * Mulberry32: a small deterministic PRNG.
 *
 * Selection has to depend on the seed and nothing else — a slice nobody can
 * regenerate is a score nobody can check — so `Math.random` is not an option.
 * @param seed - Any integer; the same seed always yields the same sequence.
 */
const createSeededRandom = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleInPlace = <T>(items: T[], nextRandom: () => number): void => {
  for (let index = items.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(nextRandom() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
};

/**
 * Allocates `sampleSize` places across sites in proportion to how many tasks
 * each contributes, using largest-remainder so the parts total exactly the
 * whole instead of drifting with rounding.
 */
const allocatePlacesPerSite = ({
  siteNames,
  taskCountBySite,
  totalTaskCount,
  sampleSize,
}: {
  siteNames: string[];
  taskCountBySite: Map<string, number>;
  totalTaskCount: number;
  sampleSize: number;
}): Map<string, number> => {
  const allocations = siteNames.map((siteName) => {
    const exactShare = (taskCountBySite.get(siteName)! / totalTaskCount) * sampleSize;
    return {
      siteName: siteName,
      places: Math.floor(exactShare),
      remainder: exactShare - Math.floor(exactShare),
    };
  });

  let allocatedPlaces = allocations.reduce((total, entry) => total + entry.places, 0);
  allocations
    .slice()
    .sort((left, right) => right.remainder - left.remainder)
    .forEach((entry) => {
      if (allocatedPlaces < sampleSize && entry.places < taskCountBySite.get(entry.siteName)!) {
        entry.places += 1;
        allocatedPlaces += 1;
      }
    });

  return new Map(allocations.map((entry) => [entry.siteName, entry.places]));
};

/**
 * Draws a site-stratified sample of tasks, reproducible from `seed` alone.
 *
 * Every site keeps its share of the sample, so a slice exercises the same
 * breadth of page structures as the full set rather than over-weighting
 * whichever sites happen to contribute the most tasks.
 *
 * Output shape: `[{ taskId: "Allrecipes--3", siteName: "Allrecipes", … }]`,
 * ordered by `taskId`.
 *
 * @param tasks - The full task set to draw from.
 * @param sampleSize - Places to fill; the whole set is returned when it is not smaller.
 * @param seed - Selects the draw; the same seed and inputs always return the same tasks.
 * @throws When `sampleSize` is not a positive whole number.
 */
export const selectStratifiedSample = ({
  tasks,
  sampleSize,
  seed,
}: {
  tasks: BenchmarkTask[];
  sampleSize: number;
  seed: number;
}): BenchmarkTask[] => {
  if (!Number.isInteger(sampleSize) || sampleSize < 1) {
    throw new Error(`Sample size must be a positive whole number, got "${sampleSize}".`);
  }
  if (sampleSize >= tasks.length) return [...tasks];

  const tasksBySite = new Map<string, BenchmarkTask[]>();
  tasks.forEach((task) => {
    const siteTasks = tasksBySite.get(task.siteName) ?? [];
    siteTasks.push(task);
    tasksBySite.set(task.siteName, siteTasks);
  });

  const siteNames = [...tasksBySite.keys()].sort();
  const placesBySite = allocatePlacesPerSite({
    siteNames: siteNames,
    taskCountBySite: new Map(siteNames.map((site) => [site, tasksBySite.get(site)!.length])),
    totalTaskCount: tasks.length,
    sampleSize: sampleSize,
  });

  // One generator drawn in a fixed site order: the sequence each site consumes
  // is part of what the seed reproduces.
  const nextRandom = createSeededRandom(seed);
  const sampled: BenchmarkTask[] = [];
  siteNames.forEach((siteName) => {
    const sitePool = [...tasksBySite.get(siteName)!];
    shuffleInPlace(sitePool, nextRandom);
    sampled.push(...sitePool.slice(0, placesBySite.get(siteName)!));
  });

  return sampled.sort((left, right) => left.taskId.localeCompare(right.taskId));
};
