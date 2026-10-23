const domainSuggestions: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.om": "gmail.com",
  gmailcom: "gmail.com",
  "gmail.comm": "gmail.com",
  "gamil.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "hotmal.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "hotmall.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.cm": "hotmail.com",
  "hotmail.om": "hotmail.com",
  "outlok.com": "outlook.com",
  "outllok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outllook.com": "outlook.com",
  "outlook.co": "outlook.com",
  "outlook.con": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahho.com": "yahoo.com",
  "yhoo.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "icloud.co": "icloud.com",
  "icloud.con": "icloud.com",
  "icloud.cm": "icloud.com",
  "iclould.com": "icloud.com",
  "iclod.com": "icloud.com",
  "icluod.com": "icloud.com",
}

/**
 * Suggests a corrected email when the domain is a common typo of a known
 * provider. Only exact, known typos are corrected so legitimate domains that
 * happen to be one edit away (for example `mail.com`) are left untouched.
 */
export function suggestEmailDomain(email: string): string | null {
  const trimmed = email.trim()
  const atIndex = trimmed.lastIndexOf("@")
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return null

  const localPart = trimmed.slice(0, atIndex)
  const domain = trimmed.slice(atIndex + 1).toLowerCase()
  const suggestion = domainSuggestions[domain]

  return suggestion ? `${localPart}@${suggestion}` : null
}
