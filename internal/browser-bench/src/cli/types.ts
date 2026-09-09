/** Flags `run.ts` accepts on the command line. */
export enum CliFlag {
  Tasks = "--tasks",
  Limit = "--limit",
  Concurrency = "--concurrency",
  Out = "--out",
  Resume = "--resume",
  MaxSteps = "--max-steps",
}

/** One benchmark run's configuration, with every default already resolved. */
export interface BenchmarkCliOptions {
  tasksPath: string;
  /** Absent means run the whole task file. */
  taskLimit?: number;
  concurrency: number;
  outDir: string;
  resume: boolean;
  /** Steps an agent may take per task. Defaults to WebVoyager's own cap. */
  maxSteps: number;
}
