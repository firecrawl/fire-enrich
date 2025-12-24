/**
 * TF-IDF Service
 * 
 * Computes TF-IDF features for text corpus.
 * Pure TypeScript implementation.
 */

import type { DifferentialSignal, ConceptCluster, TfidfVector } from '../types';

const DEFAULT_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
  'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from',
  'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'all', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will',
  'just', 'don', 'should', 'now', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did',
  'doing', 'would', 'could', 'should', 'might', 'must', 'shall', 'of',
  'this', 'that', 'these', 'those', 'am', 'it', 'its', 'i', 'me', 'my',
  'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they',
  'them', 'their', 'what', 'which', 'who', 'whom', 'why', 'how', 'as',
  'also', 'get', 'use', 'using', 'used', 'one', 'two', 'first', 'new',
  'like', 'make', 'way', 'well', 'back', 'even', 'want', 'because',
  // Web-specific
  'click', 'learn', 'read', 'see', 'view', 'page', 'home', 'menu',
  'cookie', 'cookies', 'privacy', 'policy', 'terms', 'copyright',
  'website', 'site', 'web', 'https', 'http', 'www', 'com',
  // Generic business
  'company', 'business', 'service', 'services', 'solutions', 'solution',
  'today', 'years', 'year', 'time', 'day', 'days', 'need', 'needs',
  'help', 'work', 'works', 'provide', 'provides', 'including',
]);

export interface TfidfConfig {
  maxFeatures?: number;
  ngramRange?: [number, number];
  minDocFrequency?: number;
}

export class TfidfService {
  private maxFeatures: number;
  private ngramRange: [number, number];
  private minDocFrequency: number;
  private vocabulary: string[] = [];
  private idfScores: Map<string, number> = new Map();
  private fitted: boolean = false;

  constructor(config: TfidfConfig = {}) {
    this.maxFeatures = config.maxFeatures ?? 500;
    this.ngramRange = config.ngramRange ?? [2, 3];
    this.minDocFrequency = config.minDocFrequency ?? 2;
  }

  fit(documents: string[]): void {
    const n = documents.length;
    const tokenizedDocs = documents.map(doc => this.tokenize(doc));
    
    // Count document frequency
    const docFreq = new Map<string, number>();
    for (const tokens of tokenizedDocs) {
      const uniqueTerms = new Set(tokens);
      for (const term of uniqueTerms) {
        docFreq.set(term, (docFreq.get(term) || 0) + 1);
      }
    }
    
    // Filter by min doc frequency and compute IDF
    const filteredTerms = Array.from(docFreq.entries())
      .filter(([_, freq]) => freq >= this.minDocFrequency);
    
    for (const [term, freq] of filteredTerms) {
      this.idfScores.set(term, Math.log((n + 1) / (freq + 1)) + 1);
    }
    
    // Score and select top features
    const scoredTerms = filteredTerms
      .map(([term, freq]) => ({ term, score: this.scorePhrase(term, freq) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, this.maxFeatures)
      .map(t => t.term);
    
    this.vocabulary = scoredTerms;
    this.fitted = true;
  }

  transform(document: string): TfidfVector {
    if (!this.fitted) throw new Error('Must call fit() first');
    
    const tokens = this.tokenize(document);
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    
    const docLength = tokens.length || 1;
    const vector: TfidfVector = {};
    
    for (const term of this.vocabulary) {
      const termFreq = (tf.get(term) || 0) / docLength;
      const idf = this.idfScores.get(term) || 0;
      vector[term] = termFreq * idf;
    }
    
    return vector;
  }

  computeDifferential(positiveVectors: TfidfVector[], negativeVectors: TfidfVector[]): DifferentialSignal[] {
    if (!this.fitted) throw new Error('Must call fit() first');

    const results: DifferentialSignal[] = [];

    for (const term of this.vocabulary) {
      const posCount = positiveVectors.filter(v => (v[term] || 0) > 0).length;
      const negCount = negativeVectors.filter(v => (v[term] || 0) > 0).length;
      
      const posPct = (posCount / positiveVectors.length) * 100;
      const negPct = (negCount / negativeVectors.length) * 100;
      const lift = negPct > 0 ? posPct / negPct : posPct > 0 ? 10 : 0;
      
      results.push({
        term,
        positive_pct: posPct,
        negative_pct: negPct,
        lift,
      });
    }

    return results.sort((a, b) => (b.positive_pct - b.negative_pct) - (a.positive_pct - a.negative_pct));
  }

  clusterPhrases(signals: DifferentialSignal[], maxClusters: number = 20): ConceptCluster[] {
    const topSignals = signals.slice(0, 100);
    const clusters: Map<string, DifferentialSignal[]> = new Map();
    
    for (const signal of topSignals) {
      const words = signal.term.split(' ');
      const clusterKey = words.find(w => w.length > 4 && !DEFAULT_STOP_WORDS.has(w)) || words[0];
      
      if (!clusters.has(clusterKey)) clusters.set(clusterKey, []);
      clusters.get(clusterKey)!.push(signal);
    }
    
    return Array.from(clusters.entries())
      .filter(([_, items]) => items.length >= 1)
      .map(([key, items]) => {
        const avgPosPct = items.reduce((s, i) => s + i.positive_pct, 0) / items.length;
        const avgNegPct = items.reduce((s, i) => s + i.negative_pct, 0) / items.length;
        const avgLift = items.reduce((s, i) => s + i.lift, 0) / items.length;
        const representative = items.sort((a, b) => b.lift - a.lift)[0].term;
        
        return {
          concept: key,
          phrases: items.map(i => i.term),
          avg_positive_pct: avgPosPct,
          avg_negative_pct: avgNegPct,
          avg_lift: avgLift,
          representative,
        };
      })
      .sort((a, b) => b.avg_lift - a.avg_lift)
      .slice(0, maxClusters);
  }

  private tokenize(text: string): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !DEFAULT_STOP_WORDS.has(w));

    const ngrams: string[] = [];
    const [minN, maxN] = this.ngramRange;

    for (let n = minN; n <= maxN; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        const ngram = words.slice(i, i + n).join(' ');
        if (!this.isStopNgram(ngram)) ngrams.push(ngram);
      }
    }

    return ngrams;
  }

  private isStopNgram(ngram: string): boolean {
    const words = ngram.split(' ');
    return words.every(w => DEFAULT_STOP_WORDS.has(w));
  }

  private scorePhrase(phrase: string, docFreq: number): number {
    const words = phrase.split(' ');
    let score = docFreq;
    
    if (words.length >= 2) score *= 1.5;
    if (words.length >= 3) score *= 1.3;
    
    const businessKeywords = ['customer', 'payment', 'account', 'financial', 'platform', 'data', 'analytics', 'enterprise'];
    if (businessKeywords.some(kw => phrase.includes(kw))) score *= 1.5;
    
    return score;
  }
}
