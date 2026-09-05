const LINK_RE = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
const EXCESSIVE_LINK_COUNT = 3;

const SPAM_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "viagra", re: /\bviagra\b/i },
  { name: "cialis", re: /\bcialis\b/i },
  { name: "crypto airdrop", re: /\bcrypto\s+airdrop\b/i },
  { name: "cheap seo", re: /\b(cheap|best)\s+seo\b|\bseo\s+(ranking|backlinks?)\b/i },
  { name: "payday loan", re: /\bpayday\s+loans?\b/i },
  { name: "casino bonus", re: /\b(casino|betting)\s+(bonus|winner)\b/i },
  { name: "adult spam", re: /\b(porn|xxx|onlyfans|escorts?)\b/i },
  { name: "make money fast", re: /\bmake\s+money\s+fast\b/i },
  { name: "weight loss spam", re: /\b(miracle\s+)?weight\s+loss\b/i },
  { name: "prize scam", re: /\bcongratulations[, ]+you\s+won\b/i },
  { name: "crypto investment", re: /\b(bitcoin|crypto)\s+investment\b|\bdouble\s+your\s+(btc|bitcoin|money)\b/i },
  { name: "limited time offer", re: /\blimited\s+time\s+offer\b/i },
];

const SKIP_FIELDS = new Set([
  "_honeypot",
  "_honey",
  "_subject",
  "_cc",
  "_replyto",
  "_template",
  "_format",
  "_next",
  "_blacklist",
  "_captcha",
  "_webhook",
  "_autoresponse",
  "h-captcha-response",
  "g-recaptcha-response",
]);

export type SpamVerdict = {
  isSpam: boolean;
  reasons: string[];
};

function visibleText(fields: Record<string, string>): string {
  return Object.entries(fields)
    .filter(([key]) => !SKIP_FIELDS.has(key) && !key.startsWith("_"))
    .map(([, value]) => value)
    .join("\n");
}

/**
 * Blocklist phrases come from two places, both capped by the caller: the
 * per-submission `_blacklist` field and the form's saved `blacklist_phrases`.
 * A hit is a silent spam flag — the sender still sees a normal success response
 * so they cannot probe which phrases are blocked.
 */
export function detectSpam(
  fields: Record<string, string>,
  blacklist: string[] = [],
): SpamVerdict {
  const text = visibleText(fields);
  const haystack = text.toLowerCase();
  const reasons: string[] = [];

  const links = text.match(LINK_RE) ?? [];
  if (links.length >= EXCESSIVE_LINK_COUNT) {
    reasons.push(`excessive links (${links.length})`);
  }

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.re.test(text)) {
      reasons.push(`keyword:${pattern.name}`);
    }
  }

  for (const phrase of blacklist) {
    const needle = phrase.trim().toLowerCase();
    if (needle.length > 0 && haystack.includes(needle)) {
      reasons.push(`blacklist:${needle}`);
    }
  }

  return { isSpam: reasons.length > 0, reasons };
}
