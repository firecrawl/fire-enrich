import type { CSVRow, EnrichmentField, RowEnrichmentResult } from '../types';

function serializeCSV(rows: unknown[][]): string {
  return rows.map(row => row.map(value => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',')).join('\r\n');
}

export function buildEnrichmentCSV(
  rows: CSVRow[], fields: EnrichmentField[],
  results: Map<number, RowEnrichmentResult>, emailColumn?: string,
): string {
  const headers = [emailColumn || 'email', ...fields.map(f => f.displayName),
    ...fields.map(f => `${f.displayName}_confidence`), ...fields.map(f => `${f.displayName}_source`)];
  return serializeCSV([headers, ...rows.map((row, index) => {
    const enrichments = results.get(index)?.enrichments;
    return [
      emailColumn ? row[emailColumn] : Object.values(row)[0],
      ...fields.map(f => {
        const value = enrichments?.[f.name]?.value;
        return Array.isArray(value) ? value.join('; ') : value;
      }),
      ...fields.map(f => enrichments?.[f.name]?.confidence?.toFixed(2)),
      ...fields.map(f => {
        const enrichment = enrichments?.[f.name];
        return enrichment?.sourceContext?.length
          ? enrichment.sourceContext.map(s => s.url).join('; ') : enrichment?.source;
      }),
    ];
  })]);
}

export function buildSkippedCSV(rows: CSVRow[], results: Map<number, RowEnrichmentResult>): string {
  const skipped = rows.map((row, index) => ({row, result: results.get(index)}))
    .filter(({result}) => result?.status === 'skipped');
  if (!skipped.length) return '';
  const headers = Array.from(new Set(skipped.flatMap(({row}) => Object.keys(row))));
  return serializeCSV([[...headers, 'Skip Reason'], ...skipped.map(({row, result}) => [
    ...headers.map(header => row[header]), result?.error || 'Personal email provider',
  ])]);
}
