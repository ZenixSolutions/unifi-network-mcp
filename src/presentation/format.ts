/**
 * Output shaping: one token budget for every tool result
 * (NetBox audit finding C4 — never two different budgets for the same data).
 */
export const MAX_RESULT_CHARS = 40_000;

export function formatResult(value: unknown, redact: (text: string) => string): string {
  const text = redact(JSON.stringify(value, null, 1));
  if (text.length <= MAX_RESULT_CHARS) return text;
  return (
    text.slice(0, MAX_RESULT_CHARS) +
    `\n… [truncated at ${MAX_RESULT_CHARS} characters — narrow the result with limit/offset or a filter expression]`
  );
}
