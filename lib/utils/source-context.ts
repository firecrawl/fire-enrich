export interface SourceContext {
  url: string;
  snippet: string;
  confidence: number;
}

// Match complete numeric tokens so citations cannot turn 1000 into evidence for 100.
function findNumericValue(content: string, value: number): number {
  if (!Number.isFinite(value)) return -1;
  const tokens = /(?<![\w.,+-])[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?[kmb]?(?![\w]|[.,]\d)/gi;
  for (const match of content.matchAll(tokens)) {
    const token = match[0].toLowerCase();
    const suffix = token.slice(-1);
    const multiplier = suffix === 'k' ? 1000 : suffix === 'm' ? 1000000 : suffix === 'b' ? 1000000000 : 1;
    const numeric = Number(token.replace(/[kmb]$/, '').replace(/,/g, '')) * multiplier;
    if (numeric === value) return match.index!;
  }
  return -1;
}

export function findRelevantSnippet(
  content: string,
  value: string | number | boolean | string[],
  fieldName: string,
  contextWindow: number = 200
): string {
  if (typeof value === 'boolean' || !content || value === null || value === undefined || value === '' || Array.isArray(value)) {
    return '';
  }
  
  const searchValue = String(value).toLowerCase();
  const contentLower = content.toLowerCase();
  
  // For numeric values, be more strict
  let index = -1;
  
  if (typeof value === 'number') {
    index = findNumericValue(content, value);
  } else {
    // For strings, try exact match first
    index = contentLower.indexOf(searchValue);
    
    // If no exact match, try to find partial matches for longer values
    if (index === -1 && searchValue.length > 20) {
      const words = searchValue.split(/\s+/).filter(w => w.length > 3);
      for (const word of words) {
        const wordIndex = contentLower.indexOf(word);
        if (wordIndex !== -1) {
          index = wordIndex;
          break;
        }
      }
    }
  }
  
  // Don't fall back to field name search - only return snippets that contain the actual value
  if (index === -1) {
    return '';
  }
  
  // Extract snippet with context
  const start = Math.max(0, index - contextWindow);
  const end = Math.min(content.length, index + searchValue.length + contextWindow);
  
  let snippet = content.substring(start, end);
  
  // Add ellipsis if truncated
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  
  // Clean up whitespace
  snippet = snippet.replace(/\s+/g, ' ').trim();
  
  return snippet;
}

export function highlightValue(snippet: string, value: string): string {
  if (!snippet || !value) return snippet;
  
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedValue})`, 'gi');
  
  return snippet.replace(regex, '**$1**');
}

export function validateSnippetContainsValue(
  snippet: string,
  value: string | number | boolean | string[] | null | undefined
): boolean {
  if (!snippet || value === null || value === undefined) {
    return false;
  }
  
  const snippetLower = snippet.toLowerCase();
  
  // Handle arrays
  if (Array.isArray(value)) {
    // For arrays, at least one element should be in the snippet
    return value.some(item => {
      const itemStr = String(item).toLowerCase();
      return itemStr.length > 2 && snippetLower.includes(itemStr);
    });
  }
  
  // Handle booleans
  if (typeof value === 'boolean') {
    return snippetLower.includes(value.toString());
  }
  
  // Handle numbers
  if (typeof value === 'number') {
    return findNumericValue(snippet, value) !== -1;
  }
  
  // Handle strings
  const valueStr = String(value).toLowerCase();
  
  // Skip very short values to avoid false positives
  if (valueStr.length < 3) {
    return snippetLower.includes(valueStr);
  }
  
  // For longer strings, check if significant parts are present
  if (valueStr.length > 20) {
    // Extract key words (longer than 3 chars)
    const words = valueStr.split(/\s+/).filter(w => w.length > 3);
    // Require at least 50% of key words to be present
    const matchCount = words.filter(word => snippetLower.includes(word)).length;
    return matchCount >= Math.ceil(words.length * 0.5);
  }
  
  // For medium strings, require the full value
  return snippetLower.includes(valueStr);
}