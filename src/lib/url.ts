/** Only same-site paths: "//evil.com" and "/\evil.com" would leave the site after login. */
export function safeNext(next: unknown) {
  return typeof next === "string" && /^\/(?![/\\])/.test(next) ? next : "/";
}

/** Accepts a bare invite code or a pasted invite link. */
export function inviteCodeFrom(input: string) {
  const text = input.trim();
  return (text.match(/\/g\/([^/?#\s]+)/)?.[1] ?? text).toLowerCase();
}
