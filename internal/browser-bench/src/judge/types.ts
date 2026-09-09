/**
 * The verdicts the judge may return, as the exact token its status line carries.
 *
 * The prompt and the parser are both built from these, so the wording the judge
 * is asked for and the wording the harness reads can never drift apart. A
 * verdict is a token the judge chooses from, not English the harness matches.
 */
export enum JudgeVerdictToken {
  Success = "SUCCESS",
  NotSuccess = "NOT SUCCESS",
  Blocked = "BLOCKED",
}
