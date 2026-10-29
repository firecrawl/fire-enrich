// The orchestrator labels each scraped source with a URL and an explicit body
// marker. Ground a quote in that body's text, not the page title or another
// source. URL-only source framing remains supported. Normalize whitespace and
// typographic quotation marks while preserving the words and other punctuation.
export function isGroundedEvidence(content: string, sourceUrl: unknown, quote: unknown): boolean {
  if (typeof sourceUrl !== 'string' || typeof quote !== 'string' || !quote.trim()) return false;
  try {
    if (!['http:', 'https:'].includes(new URL(sourceUrl).protocol)) return false;
  } catch {
    return false;
  }
  const normalize = (value: string) => value.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
  const needle = normalize(quote);
  const sources = [...content.matchAll(/^URL:[ \t]*([^\r\n]+)(?:\r?\n|$)/gm)];
  return sources.some((source, index) => {
    if (source[1].trim() !== sourceUrl) return false;
    let body = content.slice(source.index! + source[0].length, sources[index + 1]?.index ?? content.length);
    body = body.replace(/^\[PAGE TITLE - NOT CONTENT\]:[^\r\n]*(?:\r?\n|$)/, '');
    const marker = '=== ACTUAL CONTENT BELOW ===';
    const start = body.indexOf(marker);
    if (start !== -1) body = body.slice(start + marker.length);
    return normalize(body).includes(needle);
  });
}
