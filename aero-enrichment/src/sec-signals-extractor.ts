import OpenAI from 'openai';

export type FinancialMetrics = {
  revenue?: {
    total: number;
    bySegment: Record<string, number>;
    growthRate: number;
  };
  operatingIncome?: number;
  netIncome?: number;
  ebitda?: number;
  cashFlow?: {
    operations: number;
    free: number;
    cash: number;
  };
  debt?: {
    total: number;
    longTerm: number;
    ratio: number;
  };
  capex?: {
    total: number;
    byCategory: Record<string, number>;
  };
  rnd?: {
    total: number;
    percentageOfRevenue: number;
  };
  interestExpense?: number;
  workingCapital?: number;
  currentRatio?: number;
};

export type ProjectProgram = {
  name: string;
  type: 'government_contract' | 'defense_program' | 'commercial_partnership' | 'product_development' | 'manufacturing' | 'certification' | 'research' | 'licensing';
  description: string;
  value?: number;
  timeline?: string;
  status: 'active' | 'planned' | 'completed' | 'cancelled';
  agency?: string; // DoD, NASA, DARPA, etc.
  citation: {
    quote: string;
    section: string;
    document: string;
  };
};

export type TechnologySignal = {
  category: 'digital_transformation' | 'ai_ml' | 'cloud_computing' | 'automation' | 'iot' | 'cybersecurity' | 'software_platform' | 'additive_manufacturing' | 'computational_design' | 'simulation' | 'data_analytics';
  description: string;
  investment?: number;
  timeline?: string;
  status: 'implemented' | 'planned' | 'evaluating' | 'pilot';
  citation: {
    quote: string;
    section: string;
    document: string;
  };
};

export type BusinessChallenge = {
  category: 'supply_chain' | 'regulatory' | 'cybersecurity' | 'talent' | 'competitive' | 'geopolitical' | 'operational' | 'quality' | 'cost_inflation' | 'market_volatility';
  description: string;
  impact: 'high' | 'medium' | 'low';
  timeline?: string;
  citation: {
    quote: string;
    section: string;
    document: string;
  };
};

export type StrategicPriority = {
  category: 'growth' | 'innovation' | 'operational_excellence' | 'cost_reduction' | 'digital_transformation' | 'sustainability' | 'talent_development' | 'm_a' | 'capital_allocation' | 'customer_centric';
  description: string;
  timeline?: string;
  budget?: number;
  citation: {
    quote: string;
    section: string;
    document: string;
  };
};

export type OrganizationalChange = {
  type: 'leadership' | 'restructuring' | 'headcount' | 'facility' | 'strategic_hire' | 'board_change' | 'compensation';
  description: string;
  date?: string;
  impact: 'high' | 'medium' | 'low';
  citation: {
    quote: string;
    section: string;
    document: string;
  };
};

export type TimingUrgency = {
  priority: 'immediate' | 'critical' | 'urgent' | 'important' | 'planned';
  description: string;
  timeline?: string;
  deadline?: string;
  citation: {
    quote: string;
    section: string;
    document: string;
  };
};

export type SECSignals = {
  companyName: string;
  ticker: string;
  analysisDate: string;
  documentsAnalyzed: string[];
  
  financialMetrics: FinancialMetrics;
  projectsPrograms: ProjectProgram[];
  technologySignals: TechnologySignal[];
  businessChallenges: BusinessChallenge[];
  strategicPriorities: StrategicPriority[];
  organizationalChanges: OrganizationalChange[];
  timingUrgency: TimingUrgency[];
  
  summary: {
    totalSignals: number;
    financialHealthScore: number; // 0-100
    technologyReadinessScore: number; // 0-100
    urgencyScore: number; // 0-100
    opportunityScore: number; // 0-100
    keyFindings: string[];
    redFlags: string[];
    opportunities: string[];
    recommendedApproach: string;
  };
};

export type SignalExtractionOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  includeFinancialMetrics?: boolean;
  includeProjectsPrograms?: boolean;
  includeTechnologySignals?: boolean;
  includeBusinessChallenges?: boolean;
  includeStrategicPriorities?: boolean;
  includeOrganizationalChanges?: boolean;
  includeTimingUrgency?: boolean;
};

export class SECSignalsExtractor {
  private openai: OpenAI;

  constructor(openaiApiKey: string) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  async extractSignals(
    companyName: string,
    ticker: string,
    documents: Array<{ content: string; metadata: { url: string; title: string; date?: string } }>,
    options: SignalExtractionOptions = {}
  ): Promise<SECSignals> {
    const {
      model = 'gpt-4o',
      maxTokens = 4000,
      temperature = 0.1,
      includeFinancialMetrics = true,
      includeProjectsPrograms = true,
      includeTechnologySignals = true,
      includeBusinessChallenges = true,
      includeStrategicPriorities = true,
      includeOrganizationalChanges = true,
      includeTimingUrgency = true,
    } = options;

    // Combine documents
    const combinedContent = documents
      .map(doc => `DOCUMENT: ${doc.metadata.title}\nURL: ${doc.metadata.url}\nDATE: ${doc.metadata.date || 'Unknown'}\n\n${doc.content}`)
      .join('\n\n---\n\n');

    // Truncate if too long
    const maxLength = 50000;
    const truncatedContent = combinedContent.length > maxLength 
      ? combinedContent.substring(0, maxLength) + '...'
      : combinedContent;

    const prompt = this.buildExtractionPrompt(
      companyName,
      ticker,
      includeFinancialMetrics,
      includeProjectsPrograms,
      includeTechnologySignals,
      includeBusinessChallenges,
      includeStrategicPriorities,
      includeOrganizationalChanges,
      includeTimingUrgency
    );

    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert financial and business intelligence analyst extracting comprehensive signals from SEC filing documents. Extract ONLY factual information with exact citations.'
          },
          {
            role: 'user',
            content: `${prompt}\n\nDOCUMENTS TO ANALYZE:\n${truncatedContent}`
          }
        ],
        max_tokens: maxTokens,
        temperature,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content returned from OpenAI');
      }

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize the response
      return this.normalizeSignals(parsed, companyName, ticker, documents);
    } catch (error) {
      console.error('SEC signals extraction failed:', error);
      throw new Error(`SEC signals extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildExtractionPrompt(
    companyName: string,
    ticker: string,
    includeFinancialMetrics: boolean,
    includeProjectsPrograms: boolean,
    includeTechnologySignals: boolean,
    includeBusinessChallenges: boolean,
    includeStrategicPriorities: boolean,
    includeOrganizationalChanges: boolean,
    includeTimingUrgency: boolean
  ): string {
    return `Analyze the following SEC filing documents for ${companyName} (${ticker}) and extract comprehensive business intelligence signals.

CRITICAL INSTRUCTIONS:
1. Extract ALL numerical data from financial tables with exact values and units
2. Identify EVERY project, program, contract, and initiative mentioned
3. Extract ALL technology investments, digital initiatives, and modernization efforts
4. Capture ALL business challenges, risks, and operational issues
5. Identify ALL strategic priorities and timing indicators
6. Extract organizational changes and leadership updates

${includeFinancialMetrics ? `
FINANCIAL METRICS - Extract exact numbers from financial statements and tables:
- Revenue (total and by segment)
- Revenue growth rates (YoY, QoQ)
- Operating income, net income, EBITDA
- Cash flow from operations, free cash flow
- Cash and cash equivalents
- Total debt, long-term debt, debt ratios
- Capital expenditures by category
- R&D expenses (total and % of revenue)
- Interest expense and coverage ratios
- Working capital and current ratio
` : ''}

${includeProjectsPrograms ? `
PROJECTS & PROGRAMS - Look for:
- Government contracts (DoD, NASA, DARPA, etc.)
- Defense programs and military contracts
- Commercial partnerships and joint ventures
- Product development initiatives
- Manufacturing programs
- Certification and compliance programs
- Research collaborations
- Technology licensing deals
` : ''}

${includeTechnologySignals ? `
TECHNOLOGY SIGNALS - Identify:
- Digital transformation initiatives
- AI/ML implementations
- Cloud computing adoption
- Automation and robotics
- IoT and sensor networks
- Cybersecurity investments
- Software platform development
- Additive manufacturing/3D printing
- Computational design tools
- Simulation and modeling capabilities
- Data analytics platforms
` : ''}

${includeBusinessChallenges ? `
BUSINESS CHALLENGES - Extract:
- Supply chain disruptions
- Regulatory compliance issues
- Cybersecurity threats
- Talent acquisition challenges
- Competitive pressures
- Geopolitical risks
- Operational inefficiencies
- Quality control issues
- Cost inflation pressures
- Market volatility impacts
` : ''}

${includeStrategicPriorities ? `
STRATEGIC PRIORITIES - Look for:
- Growth strategies and market expansion
- Product innovation roadmaps
- Operational excellence initiatives
- Cost reduction programs
- Digital transformation plans
- Sustainability and ESG goals
- Talent development programs
- M&A strategies
- Capital allocation priorities
- Customer-centric initiatives
` : ''}

${includeOrganizationalChanges ? `
ORGANIZATIONAL CHANGES - Identify:
- Leadership appointments and departures
- Organizational restructuring
- Headcount changes and layoffs
- New facility openings
- Facility closures or consolidations
- Strategic hires in key roles
- Board of directors changes
- Executive compensation changes
` : ''}

${includeTimingUrgency ? `
TIMING & URGENCY - Extract:
- "Immediate", "critical", "urgent" priorities
- Quarterly and annual targets
- Multi-year strategic plans
- Specific milestone dates
- Accelerated timelines
- Delayed or cancelled programs
- Implementation schedules
` : ''}

For EVERY signal provide:
1. Exact quote from the document
2. Numerical value if mentioned (with units)
3. Context or section where found
4. Any associated table data
5. Timeline or urgency indicators

Return comprehensive JSON matching the SECSignals interface.

Focus on signals that indicate:
- Technology investment readiness
- Operational challenges requiring solutions
- Budget availability for new initiatives
- Strategic alignment with advanced technologies
- Urgent business needs

Return the JSON object exactly as specified. Do not wrap in markdown.`;
  }

  private normalizeSignals(
    parsed: any,
    companyName: string,
    ticker: string,
    documents: Array<{ content: string; metadata: { url: string; title: string; date?: string } }>
  ): SECSignals {
    const now = new Date().toISOString();
    
    return {
      companyName,
      ticker,
      analysisDate: now,
      documentsAnalyzed: documents.map(d => d.metadata.url),
      
      financialMetrics: parsed.financialMetrics || {},
      projectsPrograms: Array.isArray(parsed.projectsPrograms) ? parsed.projectsPrograms : [],
      technologySignals: Array.isArray(parsed.technologySignals) ? parsed.technologySignals : [],
      businessChallenges: Array.isArray(parsed.businessChallenges) ? parsed.businessChallenges : [],
      strategicPriorities: Array.isArray(parsed.strategicPriorities) ? parsed.strategicPriorities : [],
      organizationalChanges: Array.isArray(parsed.organizationalChanges) ? parsed.organizationalChanges : [],
      timingUrgency: Array.isArray(parsed.timingUrgency) ? parsed.timingUrgency : [],
      
      summary: {
        totalSignals: this.calculateTotalSignals(parsed),
        financialHealthScore: parsed.summary?.financialHealthScore || 0,
        technologyReadinessScore: parsed.summary?.technologyReadinessScore || 0,
        urgencyScore: parsed.summary?.urgencyScore || 0,
        opportunityScore: parsed.summary?.opportunityScore || 0,
        keyFindings: Array.isArray(parsed.summary?.keyFindings) ? parsed.summary.keyFindings : [],
        redFlags: Array.isArray(parsed.summary?.redFlags) ? parsed.summary.redFlags : [],
        opportunities: Array.isArray(parsed.summary?.opportunities) ? parsed.summary.opportunities : [],
        recommendedApproach: parsed.summary?.recommendedApproach || 'Standard approach recommended',
      },
    };
  }

  private calculateTotalSignals(parsed: any): number {
    let total = 0;
    if (parsed.projectsPrograms) total += parsed.projectsPrograms.length;
    if (parsed.technologySignals) total += parsed.technologySignals.length;
    if (parsed.businessChallenges) total += parsed.businessChallenges.length;
    if (parsed.strategicPriorities) total += parsed.strategicPriorities.length;
    if (parsed.organizationalChanges) total += parsed.organizationalChanges.length;
    if (parsed.timingUrgency) total += parsed.timingUrgency.length;
    return total;
  }
}
