import fs from 'fs';
import path from 'path';
import TurndownService from 'turndown';

export type TickerEntry = {
  cik_str: number;
  ticker: string;
  title: string;
};

export type PublicCompanyMatch = {
  isPublic: boolean;
  confidence: number;
  matchedTitle?: string;
  ticker?: string;
  cik?: string; // zero-padded 10 digits
  source?: 'overrides' | 'sec_directory';
};

export type TenKItem = {
  form: string; // 10-K or 10-K/A
  accessionNumber: string; // e.g., 0000320193-24-000093
  primaryDocument: string; // e.g., a10k20230930.htm
  reportDate?: string; // YYYY-MM-DD
  filingDate?: string; // YYYY-MM-DD
};

export type EdgarFiling = {
  form: string; // e.g., 10-K, 8-K, 10-Q, etc.
  accessionNumber: string;
  primaryDocument: string;
  reportDate?: string;
  filingDate?: string;
  description?: string;
  isExcluded: boolean; // true if it's a stock purchase/sale note
};

export type FilingDownloadResult = {
  rawPath: string;
  markdownPath: string;
  textPath: string;
};

export type FilingWithContent = {
  form: string;
  accessionNumber: string;
  primaryDocument: string;
  reportDate?: string;
  filingDate?: string;
  description?: string;
  url: string;
  markdownContent: string;
  rawHtml?: string;
  metadata: {
    ticker?: string;
    cik: string;
    companyName?: string;
    fileSize?: number;
    fetchedAt: string;
  };
};

export type FilingsQueryOptions = {
  /** Form types to include. Default: all types except stock transactions */
  formTypes?: string[];
  /** Number of months to look back. Default: 12 */
  monthsBack?: number;
  /** Maximum number of filings to return. Default: 50 */
  maxFilings?: number;
  /** Include raw HTML in response. Default: false */
  includeRawHtml?: boolean;
  /** Include stock transaction forms (3, 4, 5, 144). Default: false */
  includeStockTransactions?: boolean;
};

export type SECClientOptions = {
  userAgent?: string;
  cacheRoot?: string;
  exaApiKey?: string;
};

export class SECEdgarClient {
  private userAgent: string;
  private cacheRoot: string;
  private overridesByDomain: Record<string, string> = {};
  private overridesByName: Record<string, string> = {};
  private turndown: TurndownService;

  constructor(options: SECClientOptions = {}) {
    this.userAgent = options.userAgent || process.env.SEC_USER_AGENT || 'fire-enrich (contact: unknown@example.com)';
    this.cacheRoot = options.cacheRoot || path.join(process.cwd(), 'cache', 'sec');
    this.ensureDir(this.cacheRoot);
    this.loadOverrides();
    this.turndown = this.createTurndownService();
  }

  private createTurndownService(): TurndownService {
    const turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });

    // Remove script and style elements completely
    turndown.addRule('removeScriptsAndStyles', {
      filter: ['script', 'style', 'noscript'],
      replacement: () => ''
    });

    return turndown;
  }

  private htmlToMarkdown(html: string): string {
    // Pre-process: remove scripts, styles, and clean up
    let cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      // Remove XBRL hidden blocks completely (contain metadata, not content)
      .replace(/<ix:hidden[^>]*>[\s\S]*?<\/ix:hidden>/gi, '')
      // Remove inline XBRL tags but keep content
      .replace(/<ix:[^>]*>/gi, '')
      .replace(/<\/ix:[^>]*>/gi, '')
      // Remove XBRL namespace declarations and context refs
      .replace(/xmlns:[a-z0-9]+="[^"]*"/gi, '')
      .replace(/contextref="[^"]*"/gi, '')
      .replace(/id="[a-z0-9_-]+"/gi, '');

    // Convert tables to a simple text format since turndown tables need DOM
    cleaned = this.convertTablesToText(cleaned);

    // Use turndown for the rest
    let markdown = this.turndown.turndown(cleaned);

    // Post-process: clean up excessive whitespace and XBRL artifacts
    markdown = markdown
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/[ \t]+$/gm, '')
      // Remove lines that are just XBRL codes/references (like "0001543151false2024FY...")
      .replace(/^[a-z0-9:\/\.#_-]{50,}$/gm, '')
      // Remove lines with only namespace-like content
      .replace(/^(http:\/\/[^\s]+\s*)+$/gm, '')
      .trim();

    // Find where actual document content starts (PART I, Item 1, or similar)
    const docStartMatch = markdown.match(/\n(PART\s+I[^I]|TABLE\s+OF\s+CONTENTS|FORM\s+10-K)/i);
    if (docStartMatch && docStartMatch.index && docStartMatch.index > 1000) {
      // Skip the XBRL preamble and start from actual document
      markdown = markdown.substring(docStartMatch.index).trim();
    }

    return markdown;
  }

  private convertTablesToText(html: string): string {
    // Simple table extraction - extracts tables as formatted text blocks
    return html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match, tableContent) => {
      const rows: string[][] = [];

      // Extract rows
      const rowMatches = tableContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
      for (const rowMatch of rowMatches) {
        const cells: string[] = [];
        const cellMatches = rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
        for (const cellMatch of cellMatches) {
          // Strip HTML tags from cell content
          const cellText = cellMatch[1]
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          cells.push(cellText);
        }
        if (cells.length > 0) {
          rows.push(cells);
        }
      }

      if (rows.length === 0) return '';

      // Build markdown table
      const maxCols = Math.max(...rows.map(r => r.length));
      let md = '\n\n';
      rows.forEach((row, i) => {
        const paddedRow = [...row];
        while (paddedRow.length < maxCols) paddedRow.push('');
        md += '| ' + paddedRow.join(' | ') + ' |\n';
        if (i === 0) {
          md += '| ' + paddedRow.map(() => '---').join(' | ') + ' |\n';
        }
      });
      return md + '\n';
    });
  }

  private ensureDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private loadOverrides() {
    // Optional JSON files: config/domain_ticker_overrides.json, config/name_ticker_overrides.json
    try {
      const domainPath = path.join(process.cwd(), 'config', 'domain_ticker_overrides.json');
      if (fs.existsSync(domainPath)) {
        const raw = fs.readFileSync(domainPath, 'utf-8');
        this.overridesByDomain = JSON.parse(raw);
      }
    } catch {}
    try {
      const namePath = path.join(process.cwd(), 'config', 'name_ticker_overrides.json');
      if (fs.existsSync(namePath)) {
        const raw = fs.readFileSync(namePath, 'utf-8');
        this.overridesByName = JSON.parse(raw);
      }
    } catch {}
  }

  private async fetchJSON<T = unknown>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`SEC request failed: ${res.status} ${res.statusText} for ${url}`);
    }
    return res.json() as Promise<T>;
  }

  private getTickerCachePath(): string {
    return path.join(this.cacheRoot, 'company_tickers.json');
  }

  async loadTickerDirectory(forceRefresh: boolean = false): Promise<TickerEntry[]> {
    const cachePath = this.getTickerCachePath();
    if (!forceRefresh && fs.existsSync(cachePath)) {
      try {
        const raw = fs.readFileSync(cachePath, 'utf-8');
        const obj = JSON.parse(raw) as Record<string, TickerEntry> | TickerEntry[];
        if (Array.isArray(obj)) return obj;
        return Object.values(obj);
      } catch {
        // fall through to refetch
      }
    }

    const url = 'https://www.sec.gov/files/company_tickers.json';
    const data = await this.fetchJSON<Record<string, TickerEntry>>(url);
    const arr = Object.values(data);
    fs.writeFileSync(cachePath, JSON.stringify(arr, null, 2));
    return arr;
  }

  async identifyPublicCompany(companyName: string, website?: string): Promise<PublicCompanyMatch> {
    try {
      // 1) Overrides (domain/name -> ticker)
      const domain = (website || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      if (domain && this.overridesByDomain[domain]) {
        return { isPublic: true, confidence: 1, matchedTitle: companyName, ticker: this.overridesByDomain[domain], cik: undefined, source: 'overrides' };
      }
      
      const normalizedName = this.normalizeCompanyName(companyName);
      if (normalizedName && this.overridesByName[normalizedName]) {
        return { isPublic: true, confidence: 1, matchedTitle: companyName, ticker: this.overridesByName[normalizedName], cik: undefined, source: 'overrides' };
      }

      // 2) SEC directory matching
      const directory = await this.loadTickerDirectory();
      const match = this.findCompanyMatch(companyName, directory);

      if (match) {
        const cikPadded = this.zeroPadCIK(match.entry.cik_str);
        return {
          isPublic: true,
          confidence: Number(match.score.toFixed(2)),
          matchedTitle: match.entry.title,
          ticker: match.entry.ticker,
          cik: cikPadded,
          source: 'sec_directory',
        };
      }

      return { isPublic: false, confidence: 0 };
    } catch (err) {
      return { isPublic: false, confidence: 0 };
    }
  }

  async getCompanySubmissions(cik: string) {
    const cikPadded = this.zeroPadCIK(cik);
    const url = `https://data.sec.gov/submissions/CIK${cikPadded}.json`;
    return this.fetchJSON<any>(url);
  }

  async list10KFilings(cik: string, maxCount: number = 5): Promise<TenKItem[]> {
    const submissions = await this.getCompanySubmissions(cik);
    const filings = submissions?.filings?.recent;
    if (!filings) return [];
    const out: TenKItem[] = [];
    for (let i = 0; i < filings.form.length; i++) {
      const form = filings.form[i] as string;
      if (form !== '10-K' && form !== '10-K/A') continue;
      out.push({
        form,
        accessionNumber: filings.accessionNumber[i] as string,
        primaryDocument: filings.primaryDocument[i] as string,
        reportDate: filings.reportDate[i] as string | undefined,
        filingDate: filings.filingDate[i] as string | undefined,
      });
    }
    return out.slice(0, maxCount);
  }

  async listAllFilings(cik: string, maxCount: number = 50): Promise<EdgarFiling[]> {
    const submissions = await this.getCompanySubmissions(cik);
    const filings = submissions?.filings?.recent;
    if (!filings) return [];
    
    const out: EdgarFiling[] = [];
    for (let i = 0; i < filings.form.length && out.length < maxCount; i++) {
      const form = filings.form[i] as string;
      const description = filings.primaryDocument[i] as string;
      
      // Exclude stock purchase/sale related filings
      const isExcluded = this.isStockTransactionFiling(form, description);
      
      out.push({
        form,
        accessionNumber: filings.accessionNumber[i] as string,
        primaryDocument: filings.primaryDocument[i] as string,
        reportDate: filings.reportDate[i] as string | undefined,
        filingDate: filings.filingDate[i] as string | undefined,
        description,
        isExcluded,
      });
    }
    return out;
  }

  async downloadFiling(cik: string, item: EdgarFiling): Promise<FilingDownloadResult> {
    const url = this.buildFilingURL(cik, item.accessionNumber, item.primaryDocument);
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': '*/*',
      }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText} for ${item.form} filing ${item.accessionNumber}`);
    }

    const filingsDir = this.getAllFilingsDir(cik);
    const year = (item.reportDate || item.filingDate || '').slice(0, 4) || 'unknown';
    const month = (item.reportDate || item.filingDate || '').slice(5, 7) || '01';
    const day = (item.reportDate || item.filingDate || '').slice(8, 10) || '01';
    const dateStr = `${year}-${month}-${day}`;
    const baseName = `${dateStr}-${item.form}-${item.accessionNumber.replace(/-/g, '')}`;
    const ext = path.extname(item.primaryDocument).toLowerCase();
    const rawFile = path.join(filingsDir, `${baseName}${ext || '.html'}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(rawFile, buf);

    // Convert to Markdown / Text
    let markdownContent = '';
    let plainText = '';

    if (ext === '.htm' || ext === '.html' || ext === '') {
      const html = buf.toString('utf-8');
      // Simple HTML to text conversion (you might want to use a proper library)
      plainText = this.htmlToText(html);
      markdownContent = `# ${item.form} Filing\n\n${plainText}`;
    } else if (ext === '.txt') {
      const text = buf.toString('utf-8');
      plainText = text;
      markdownContent = `# ${item.form} Filing\n\n${text}`;
    } else {
      // Default: try treat as text
      const text = buf.toString('utf-8');
      plainText = text;
      markdownContent = `# ${item.form} Filing\n\n${text}`;
    }

    const mdPath = path.join(filingsDir, `${baseName}.md`);
    fs.writeFileSync(mdPath, markdownContent, 'utf-8');
    const textPath = path.join(filingsDir, `${baseName}.txt`);
    fs.writeFileSync(textPath, plainText, 'utf-8');

    return { rawPath: rawFile, markdownPath: mdPath, textPath };
  }

  async downloadAllFilings(cik: string, maxCount: number = 50): Promise<Array<{ item: EdgarFiling; paths: FilingDownloadResult }>> {
    const items = await this.listAllFilings(cik, maxCount);
    const outputs: Array<{ item: EdgarFiling; paths: FilingDownloadResult }> = [];
    
    for (const item of items) {
      if (item.isExcluded) {
        console.log(`  Skipping excluded filing: ${item.form} - ${item.description}`);
        continue;
      }
      
      try {
        const paths = await this.downloadFiling(cik, item);
        outputs.push({ item, paths });
        
        // Add a small delay between requests to avoid rate limiting
        if (outputs.length < items.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (err) {
        console.warn(`Failed to process filing ${item.accessionNumber}: ${(err as Error).message}`);
        continue;
      }
    }
    
    return outputs;
  }

  /**
   * Get all filings from the last N months with full markdown content.
   * This is the main method for retrieving SEC documents for LLM processing.
   */
  async getFilingsWithContent(
    cikOrTicker: string,
    options: FilingsQueryOptions = {}
  ): Promise<FilingWithContent[]> {
    const {
      formTypes,
      monthsBack = 12,
      maxFilings = 50,
      includeRawHtml = false,
      includeStockTransactions = false,
    } = options;

    // Resolve ticker to CIK if needed
    let cik = cikOrTicker;
    let ticker: string | undefined;
    let companyName: string | undefined;

    if (!/^\d+$/.test(cikOrTicker)) {
      // It's a ticker, find the CIK
      const directory = await this.loadTickerDirectory();
      const entry = directory.find(e => e.ticker.toLowerCase() === cikOrTicker.toLowerCase());
      if (!entry) {
        throw new Error(`Ticker "${cikOrTicker}" not found in SEC directory`);
      }
      cik = this.zeroPadCIK(entry.cik_str);
      ticker = entry.ticker;
      companyName = entry.title;
    } else {
      cik = this.zeroPadCIK(cikOrTicker);
    }

    // Get company name if we don't have it
    if (!companyName) {
      try {
        const submissions = await this.getCompanySubmissions(cik);
        companyName = submissions?.name;
        ticker = ticker || submissions?.tickers?.[0];
      } catch {
        // Continue without company name
      }
    }

    // Get all filings metadata
    const submissions = await this.getCompanySubmissions(cik);
    const filings = submissions?.filings?.recent;
    if (!filings) return [];

    // Calculate date cutoff
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // Filter filings
    const filteredFilings: EdgarFiling[] = [];
    for (let i = 0; i < filings.form.length && filteredFilings.length < maxFilings; i++) {
      const form = filings.form[i] as string;
      const filingDate = (filings.filingDate[i] as string) || '';
      const reportDate = (filings.reportDate[i] as string) || '';
      const description = (filings.primaryDocument[i] as string) || '';
      const accessionNumber = filings.accessionNumber[i] as string;
      const primaryDocument = filings.primaryDocument[i] as string;

      // Date filter
      const dateToCheck = filingDate || reportDate;
      if (dateToCheck < cutoffStr) continue;

      // Stock transaction filter
      if (!includeStockTransactions && this.isStockTransactionFiling(form, description)) {
        continue;
      }

      // Form type filter
      if (formTypes && formTypes.length > 0) {
        const normalizedForm = form.toUpperCase();
        const matches = formTypes.some(ft => normalizedForm.includes(ft.toUpperCase()));
        if (!matches) continue;
      }

      filteredFilings.push({
        form,
        accessionNumber,
        primaryDocument,
        reportDate,
        filingDate,
        description,
        isExcluded: false,
      });
    }

    // Fetch content for each filing
    const results: FilingWithContent[] = [];

    for (const filing of filteredFilings) {
      try {
        const url = this.buildFilingURL(cik, filing.accessionNumber, filing.primaryDocument);

        const res = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': '*/*',
          }
        });

        if (!res.ok) {
          console.warn(`Failed to fetch ${filing.form} ${filing.accessionNumber}: ${res.status}`);
          continue;
        }

        const rawHtml = await res.text();
        const markdownContent = this.htmlToMarkdown(rawHtml);

        results.push({
          form: filing.form,
          accessionNumber: filing.accessionNumber,
          primaryDocument: filing.primaryDocument,
          reportDate: filing.reportDate,
          filingDate: filing.filingDate,
          description: filing.description,
          url,
          markdownContent,
          rawHtml: includeRawHtml ? rawHtml : undefined,
          metadata: {
            ticker,
            cik,
            companyName,
            fileSize: rawHtml.length,
            fetchedAt: new Date().toISOString(),
          },
        });

        // Rate limiting: SEC asks for 10 requests/second max
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (err) {
        console.warn(`Error processing ${filing.form} ${filing.accessionNumber}: ${(err as Error).message}`);
      }
    }

    return results;
  }

  /**
   * Convenience method to get filings by ticker with content.
   * Returns structured data ready for LLM processing.
   */
  async getFilingsByTicker(
    ticker: string,
    options: FilingsQueryOptions = {}
  ): Promise<{
    ticker: string;
    cik: string;
    companyName?: string;
    filings: FilingWithContent[];
    summary: {
      totalFilings: number;
      formTypes: Record<string, number>;
      dateRange: { earliest?: string; latest?: string };
    };
  }> {
    const filings = await this.getFilingsWithContent(ticker, options);

    if (filings.length === 0) {
      throw new Error(`No filings found for ticker "${ticker}"`);
    }

    // Build summary
    const formTypes: Record<string, number> = {};
    let earliest: string | undefined;
    let latest: string | undefined;

    for (const f of filings) {
      formTypes[f.form] = (formTypes[f.form] || 0) + 1;
      const date = f.filingDate || f.reportDate;
      if (date) {
        if (!earliest || date < earliest) earliest = date;
        if (!latest || date > latest) latest = date;
      }
    }

    return {
      ticker: filings[0].metadata.ticker || ticker,
      cik: filings[0].metadata.cik,
      companyName: filings[0].metadata.companyName,
      filings,
      summary: {
        totalFilings: filings.length,
        formTypes,
        dateRange: { earliest, latest },
      },
    };
  }

  // Helper methods
  private zeroPadCIK(cikNumber: number | string): string {
    const numeric = `${cikNumber}`.replace(/^0+/, '');
    return numeric.padStart(10, '0');
  }

  private normalizeCompanyName(name: string): string {
    const lower = name.toLowerCase().trim();
    const cleaned = lower
      .replace(/[&.,'"()\-]/g, ' ')
      .replace(/\b(incorporated|inc|corp|corporation|ltd|limited|plc|group|holdings|co|company|s\.a\.|s\.a|sa|ag|nv|se|ab)\b/g, '')
      .replace(/\b(operations|international|aerospace|defense|systems|technologies|solutions|services|manufacturing|aviation|space|military)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned;
  }

  private findCompanyMatch(companyName: string, directory: TickerEntry[]): { entry: TickerEntry; score: number } | null {
    const normalizedName = this.normalizeCompanyName(companyName);
    const targetTokens = new Set(normalizedName.split(' ').filter(Boolean));

    // If the name is very short (one token), also try exact substring match
    const isShortName = targetTokens.size <= 2;

    let best: { entry: TickerEntry; score: number } | null = null;

    for (const entry of directory) {
      const normalizedTitle = this.normalizeCompanyName(entry.title);
      const titleTokens = new Set(normalizedTitle.split(' ').filter(Boolean));

      // Calculate Jaccard similarity
      const jaccard = this.jaccardSimilarity(targetTokens, titleTokens);

      // Also check if all target tokens are contained in title (subset match)
      const allTargetInTitle = [...targetTokens].every(t => titleTokens.has(t));
      const subsetScore = allTargetInTitle ? 0.85 : 0;

      // For short names, also check if the first significant word matches
      let firstWordScore = 0;
      if (isShortName && targetTokens.size > 0) {
        const targetFirst = [...targetTokens][0];
        if (targetFirst && targetFirst.length >= 4 && titleTokens.has(targetFirst)) {
          firstWordScore = 0.8;
        }
      }

      const score = Math.max(jaccard, subsetScore, firstWordScore);

      if (score >= 0.5 && (!best || score > best.score)) {
        best = { entry, score };
      }
    }

    return best;
  }

  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    const intersectionSize = new Set([...a].filter(x => b.has(x))).size;
    const unionSize = new Set([...a, ...b]).size || 1;
    return intersectionSize / unionSize;
  }

  private isStockTransactionFiling(form: string, description: string): boolean {
    const lowerDesc = description.toLowerCase();

    // Exclude forms related to stock transactions
    const stockForms = ['3', '4', '5', '144', '3/A', '4/A', '5/A', '144/A'];
    if (stockForms.includes(form)) return true;
    
    // Exclude descriptions related to stock purchases/sales
    const stockKeywords = [
      'stock purchase', 'stock sale', 'share purchase', 'share sale',
      'insider trading', 'beneficial ownership', 'ownership change',
      'acquisition of securities', 'disposition of securities',
      'form 3', 'form 4', 'form 5', 'form 144'
    ];
    
    return stockKeywords.some(keyword => lowerDesc.includes(keyword));
  }

  private buildFilingURL(cik: string, accessionNumber: string, primaryDocument: string): string {
    const cikNoZeros = `${cik}`.replace(/^0+/, '');
    const accNoNoDashes = accessionNumber.replace(/-/g, '');
    return `https://www.sec.gov/Archives/edgar/data/${cikNoZeros}/${accNoNoDashes}/${primaryDocument}`;
  }

  private getAllFilingsDir(cik: string): string {
    const dir = path.join(this.cacheRoot, cik, 'all-filings');
    this.ensureDir(dir);
    return dir;
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
