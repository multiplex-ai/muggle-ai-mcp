import { BenchmarkOutcome } from "../domain/types";
import { JUDGE_VERDICT_LINE_PREFIX } from "./constants";
import { JudgeVerdictToken } from "./types";

const carriesVerdict = (judgeReply: string, token: JudgeVerdictToken): boolean =>
  new RegExp(`${JUDGE_VERDICT_LINE_PREFIX}\\s*${token}\\b`, "i").test(judgeReply);

const buildJudgePrompt = ({
  instruction,
  finalAnswer,
}: {
  instruction: string;
  finalAnswer: string;
}): string =>
  `You are evaluating whether a web agent completed its task.\n\n` +
  `Task: ${instruction}\n\n` +
  `Agent's final answer: ${finalAnswer}\n\n` +
  `The screenshots show the agent's last actions. Decide whether the task was ` +
  `completed. Reply with your reasoning, then a final line reading exactly one of:\n` +
  `"${JUDGE_VERDICT_LINE_PREFIX} ${JudgeVerdictToken.Success}" — the agent completed the task.\n` +
  `"${JUDGE_VERDICT_LINE_PREFIX} ${JudgeVerdictToken.NotSuccess}" — the agent did not complete it.\n` +
  `"${JUDGE_VERDICT_LINE_PREFIX} ${JudgeVerdictToken.Blocked}" — the site never let the agent ` +
  `reach its content, because it served an automated-access check: a security or bot ` +
  `verification interstitial, a "checking your browser" hold, or an outright access ` +
  `denial. Choose this only when the screenshots show that barrier standing between the ` +
  `agent and the content it needed. An agent that reached the content and then got the ` +
  `task wrong is ${JudgeVerdictToken.NotSuccess}.`;

/**
 * Scores one task attempt by WebVoyager's judge protocol: the judge model reads
 * the instruction, the agent's answer, and the trailing screenshots, and returns
 * one of three verdicts. Model invocation is injected so the protocol stays
 * testable without a network call.
 *
 * The blocked verdict is asked of the judge rather than inferred here. The judge
 * is the only party that has already read the screenshots, and asking it to pick
 * a token beats matching English in its reasoning — interstitial copy varies by
 * vendor and locale, and prose patterns would both miss real blocks and fire on
 * a verdict that merely mentions one.
 *
 * Success is checked before blocked: an agent that finished the task did reach
 * the content, whatever else the reasoning mentions on the way there.
 *
 * Verdicts are not bit-reproducible: the judge model rejects `temperature`
 * outright, so a re-judged batch can move by a task or two. Re-judging is
 * therefore a new measurement, not a replay of the old one.
 *
 * A response the judge protocol cannot parse counts as a failure, never an
 * error — infrastructure classification belongs to the orchestrator, and
 * letting the judge mint errors would quietly shrink the scored denominator.
 *
 * Output shape: `{ outcome: "pass", reasoning: "<raw judge text>" }`
 */
export const judgeTaskAsync = async ({
  instruction,
  finalAnswer,
  screenshotPaths,
  invokeJudgeAsync,
}: {
  instruction: string;
  finalAnswer: string;
  screenshotPaths: string[];
  invokeJudgeAsync: (prompt: string, screenshotPaths: string[]) => Promise<string>;
}): Promise<{ outcome: BenchmarkOutcome; reasoning: string }> => {
  const reasoning = await invokeJudgeAsync(
    buildJudgePrompt({ instruction: instruction, finalAnswer: finalAnswer }),
    screenshotPaths,
  );

  const resolveOutcome = (): BenchmarkOutcome => {
    if (carriesVerdict(reasoning, JudgeVerdictToken.Success)) return BenchmarkOutcome.Pass;
    if (carriesVerdict(reasoning, JudgeVerdictToken.Blocked)) return BenchmarkOutcome.Blocked;
    return BenchmarkOutcome.Fail;
  };

  return {
    outcome: resolveOutcome(),
    reasoning: reasoning,
  };
};
