import { MAX_STEPS_PER_TASK } from "../domain/constants";
import { BenchmarkOutcome, type TaskResult } from "../domain/types";

/**
 * Renders the batch report.
 *
 * The pass-rate denominator is passes + fails only — infrastructure errors and
 * bot-defence blocks are counted and reported separately so a lockout, a crash,
 * or a site that refuses automated access can never read as a capability
 * regression. This differs from how most published browser-agent scores are
 * computed, so any published number must say so.
 *
 * Blocked attempts get their own line and keep their rows in the table, printed
 * even at zero. A benchmark that reports what it could not reach is more honest
 * than one that hides it, and a line that appears only when non-zero is a line
 * nobody learns to look for.
 *
 * The step budget is printed beside the pass rate, and a budget above
 * WebVoyager's own cap is labelled a deviation in the same line as the score.
 * A raised budget makes the number incomparable to every published result, and
 * a caveat that lives only in the surrounding prose is a caveat that gets
 * dropped the first time someone quotes the figure.
 *
 * Output shape: a Markdown document opening with
 * `**Pass rate:** 50.0% (scored 2, infrastructure errors 1)`.
 *
 * @param params.maxSteps - Steps each task was allowed.
 */
export const renderReport = (
  results: TaskResult[],
  { maxSteps }: { maxSteps: number } = { maxSteps: MAX_STEPS_PER_TASK },
): string => {
  const passes = results.filter((result) => result.outcome === BenchmarkOutcome.Pass).length;
  const fails = results.filter((result) => result.outcome === BenchmarkOutcome.Fail).length;
  const errors = results.filter((result) => result.outcome === BenchmarkOutcome.Error).length;
  const blocked = results.filter((result) => result.outcome === BenchmarkOutcome.Blocked).length;
  const scored = passes + fails;
  const passRate = scored === 0 ? 0 : (passes / scored) * 100;
  const totalTokens = results.reduce((sum, result) => sum + result.tokensUsed, 0);

  return [
    `# Browser-capability benchmark`,
    ``,
    `**Pass rate:** ${passRate.toFixed(1)}% (scored ${scored}, infrastructure errors ${errors})`,
    `**Blocked by bot defence:** ${blocked} — the site refused automated access, so the agent's capability was never exercised; excluded from the pass rate`,
    `**Step budget:** ${maxSteps}${
      maxSteps > MAX_STEPS_PER_TASK
        ? ` — raised above WebVoyager's cap of ${MAX_STEPS_PER_TASK}; this score is NOT comparable to published WebVoyager results`
        : ""
    }`,
    `**Total tokens:** ${totalTokens}`,
    ``,
    `| Task | Outcome | Steps | Duration (ms) | Tokens |`,
    `| :--- | :------ | ----: | ------------: | -----: |`,
    ...results.map(
      (result) =>
        `| ${result.taskId} | ${result.outcome} | ${result.stepCount} | ${result.durationMs} | ${result.tokensUsed} |`,
    ),
  ].join("\n");
};
