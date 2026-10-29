// The orchestrator labels each scraped source with a URL and an explicit body
// marker. Ground a quote in that body's text, not the page title or another
// source. Compare only whitespace normalization; preserve words and punctuation.
export function isGroundedEvidence(content: string, sourceUrl: unknown, quote: unknown): boolean {
  if (typeof sourceUrl !== 'string' || typeof quote !== 'string' || !quote.trim()) return false;
  try {
    if (!['http:', 'https:'].includes(new URL(sourceUrl).protocol)) return false;
  } catch {
    return false;
  }
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  const needle = normalize(quote);
  const marker = /^URL: ([^\r\n]+)\r?\n\[PAGE TITLE - NOT CONTENT\]:[^\r\n]*\r?\n\s*\r?\n=== ACTUAL CONTENT BELOW ===\r?\n/gm;
  const sources = [...content.matchAll(marker)];
  return sources.some((source, index) => source[1].trim() === sourceUrl
    && normalize(content.slice(source.index! + source[0].length, sources[index + 1]?.index ?? content.length)).includes(needle));
}
