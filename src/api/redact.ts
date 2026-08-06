/**
 * Central redaction: the API key must never appear in tool results, logs,
 * or error messages (standards/security-standard.md). Every string that can
 * carry upstream content passes through here.
 */
export function makeRedactor(secrets: readonly string[]): (text: string) => string {
  const material = secrets.filter((s) => s.length > 0);
  return (text: string): string => {
    let out = text;
    for (const secret of material) {
      out = out.split(secret).join('[REDACTED]');
    }
    return out;
  };
}
