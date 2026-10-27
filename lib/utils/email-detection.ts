import { CSVRow } from '@/lib/types';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function detectEmailColumn(rows: CSVRow[], columns: string[]): {
  columnName: string | null;
  columnIndex: number;
  confidence: number;
} {
  if (rows.length === 0 || columns.length === 0) {
    return { columnName: null, columnIndex: -1, confidence: 0 };
  }

  let bestColumn: string | null = null;
  let bestEmailCount = 0;
  let bestNameScore = -1;
  let bestIndex = -1;

  columns.forEach((column, index) => {
    // Check if column name suggests email
    const columnLower = column.toLowerCase();
    const nameScore = (
      columnLower.includes('email') ? 10 :
      columnLower.includes('mail') ? 8 :
      columnLower.includes('e-mail') ? 8 :
      columnLower.includes('contact') ? 3 :
      0
    );

    // Check actual data in the column
    const sampleSize = Math.min(rows.length, 10); // Check up to 10 rows
    let emailCount = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      const value = rows[i][column]?.trim();
      if (value && EMAIL_REGEX.test(value)) {
        emailCount++;
      }
    }

    // A header hint must never outweigh actual addresses in another column.
    if (emailCount > 0 && (emailCount > bestEmailCount ||
        (emailCount === bestEmailCount && nameScore > bestNameScore))) {
      bestEmailCount = emailCount;
      bestNameScore = nameScore;
      bestColumn = column;
      bestIndex = index;
    }
  });

  // Report the observed email fraction; a suggestive header adds no evidence.
  const confidence = (bestEmailCount / Math.min(rows.length, 10)) * 100;

  return {
    columnName: bestColumn,
    columnIndex: bestIndex,
    confidence: Math.round(confidence)
  };
}

export function getPreviewData(rows: CSVRow[], limit: number = 5): CSVRow[] {
  return rows.slice(0, limit);
}