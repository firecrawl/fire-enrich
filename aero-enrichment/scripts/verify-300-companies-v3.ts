#!/usr/bin/env npx tsx
/**
 * Verify 300 Fintech 250 companies against TAM v3 results
 */
import * as fs from 'fs';
import * as path from 'path';

// All 300 companies to verify
const allCompanies = [
  // Enterprise Finance (50)
  'ADVANCE AI', 'Airwallex', 'Alloy', 'Aspire', 'Backbase', 'BILL', 'BioCatch', 'Brex',
  'Candex', 'Capitolis', 'ClearBank', 'ComplyAdvantage', 'Datasnipper', 'Finastra',
  'Finnovating', 'FIS', 'FloQast', 'FreshBooks', 'Galileo', 'GlossGenius', 'Gusto',
  'Intuit', 'Justt', 'Kyriba', 'MX Technologies', 'Navan', 'NCino', 'Nova Credit',
  'PayFit', 'Personetics', 'Plaid', 'Pleo', 'Prestatech', 'Q2', 'SEON', 'Socure',
  'Soldo', 'Spendesk', 'Sumsub', 'SymphonyAI', 'Temenos', 'Thought Machine', 'Tipalti',
  'Trovata', 'TrueLayer', 'Xero', 'Yapily', 'Zafin', 'Zest AI', 'Zip',
  // Digital Assets (20)
  'Binance', 'BitGo', 'Blockdaemon', 'Chainalysis', 'Coinbase', 'CoinTracker', 'Consensys',
  'Figment', 'Finery Markets', 'Fireblocks', 'Galaxy', 'Ledger', 'Magic Eden', 'OKX',
  'OpenSea', 'OSL Group', 'StraitsX', 'Turnkey', 'VGS', 'Zodia Custody',
  // Neobanks (35)
  'Agibank', 'Allica Bank', 'Atom bank', 'Au Jibun Bank', 'Bunq', 'C6 Bank', 'Chime',
  'Comun', 'Dave', 'EQ Bank', 'Fondeadora', 'Inter', 'KakaoBank', 'Klar', 'Koho',
  'Lunar', 'Mercury', 'Monzo', 'N26', 'Neo Financial', 'Neon', 'Nest Bank', 'Niyo',
  'Nubank', 'Revolut', 'SoFi', 'Starling Bank', 'Step', 'Stori', 'TBC Uzbekistan',
  'Tide', 'Uala', 'Upgrade', 'Varo Bank', 'Zopa Bank',
  // Insurance Fintechs (30)
  '180 Seguros', 'Accelerant', 'Acko General Insurance', 'Alan', 'Blink Parametric',
  'Digit Insurance', 'Entsia', 'EvolutionIQ', 'Guidewire Software', 'Hi Marley', 'Hippo',
  'Hyperexponential', 'Insurify', 'Ki', 'Kin Insurance', 'Lemonade', 'Mylo',
  'Next Insurance', 'Oscar Insurance', 'Peak3', 'PolicyBazaar', 'Qoala', 'RenewBuy',
  'Roadzen', 'Root Insurance', 'Sapiens International', 'Snapsheet', 'Veracity Insurance Solutions',
  'Vitesse', 'Wakam',
  // Wealth Management (50)
  'Acorns', 'Addepar', 'Albert', 'AngelList', 'Atticus', 'Betterment', 'Bilt', 'Bitpanda',
  'Check24', 'Clear Street', 'Clearwater Analytics', 'Cleo AI', 'Docupace', 'DriveWealth',
  'Empower', 'Endowus', 'EToro', 'Fundrise', 'GTN', 'Hakbah', 'ICapital',
  'Interactive Brokers', 'LendingTree', 'Monarch Money', 'Moneybox', 'Moneyfarm',
  'MoneyLion', 'MoneySuperMarket', 'NerdWallet', 'Oportun', 'PiggyVest', 'Plus500',
  'Pulley', 'Quicken', 'Raisin', 'Raiz', 'Robinhood', 'Scalable Capital', 'Self Financial',
  'Smart', 'StashAway', 'Taxfix', 'Tiger Brokers', 'Trade Republic', 'Trading 212',
  'Uswitch', 'Vestwell', 'Wealthfront', 'Wealthsimple', 'Webull',
  // Payments (75)
  'ACI Worldwide', 'Adyen', 'AffiniPay', 'Affirm', 'Ant Group', 'Ascend Money', 'Balance',
  'BharatPe', 'Bkash', 'BLIK', 'Block', 'Checkout.com', 'Convera', 'DANA', 'Fiserv',
  'Freecharge', 'GoTo', 'Grab Financial Group', 'IBanFirst', 'Imprint', 'Interswitch',
  'Klarna', 'Lianlian DigiTech', 'Lightspeed', 'Marqeta', 'Mastercard', 'Mollie',
  'Moniepoint', 'MyFawry', 'Nexi', 'Nium', 'Nuvei', 'Oceanpayment', 'Okoora', 'One Inc',
  'Opay', 'PalmPay', 'Paymentus', 'Paymob', 'Payoneer', 'PayPal', 'Paysafe', 'Paystand',
  'Paytm', 'PayU', 'PhonePe', 'Pliant', 'Priority', 'Rapyd', 'Razorpay', 'Remitly',
  'Ripple', 'Sezzle', 'Sipay', 'Stone', 'Stripe', 'SumUp', 'SUNRATE', 'Tazapay',
  'Tencent', 'TerraPay', 'Thunes', 'Toast', 'Toss', 'Trustly', 'Tyro', 'Visa',
  'Wave Money', 'Wise', 'Ant International', 'Yoco', 'YouTrip', 'Yuno', 'Zaver', 'Zilch',
  // Alternative Finance (40)
  'Akulaku', 'Aye Finance', 'Best Egg', 'Biz2Credit', 'Bluevine', 'Bondora', 'C2FO',
  'CapBay', 'Collin Crowdfund', 'Companisto', 'Crowd Street', 'Earnest', 'Enova',
  'Fundbox', 'Funding Circle', 'Funding Societies', 'Happy Money', 'InCred', 'Iuvo group',
  'Iwoca', 'Kueski', 'Liberis', 'LoanDepot', 'MicroVentures', 'M-KOPA', 'PeerBerry',
  'Plenti', 'Prosper', 'Raize', 'SellersFi', 'Sun Finance', 'Tala', 'Teylor',
  'UnaFinancial', 'Upstart', 'Urbanitae', 'Wayflyer', 'WeLend', 'YouLend', 'Yubi'
];

const tamResultsPath = path.join(__dirname, '../data/tam-expansion-v3-results.csv');

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function main() {
  // Check if file exists
  if (!fs.existsSync(tamResultsPath)) {
    console.log('TAM v3 results file not found yet. Waiting...');
    return;
  }

  const tamContent = fs.readFileSync(tamResultsPath, 'utf-8');

  // Build a map of all company names in TAM results (normalized -> original)
  const tamCompanyMap = new Map<string, string>();
  const tamDomainMap = new Map<string, string>();

  // Parse CSV
  const lines = tamContent.split('\n');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Extract company_name (column 1) and domain
    const match = line.match(/^[^,]*,([^,]*)/);
    if (match && match[1]) {
      const name = match[1].replace(/^"|"$/g, '').trim();
      if (name) {
        tamCompanyMap.set(normalizeForMatch(name), name);
      }
    }

    // Also extract domain (column after company_website)
    const domainMatch = line.match(/,([\w.-]+\.(?:com|co|io|ai|net|org|app|finance|bank|money|pay)[^,]*),/);
    if (domainMatch) {
      tamDomainMap.set(normalizeForMatch(domainMatch[1]), domainMatch[1]);
    }
  }

  console.log(`Total companies in TAM v3 results: ${tamCompanyMap.size}\n`);

  // Check each company
  const found: { target: string; tamName: string; method: string }[] = [];
  const missing: string[] = [];

  for (const company of allCompanies) {
    const normalized = normalizeForMatch(company);

    // Exact match
    if (tamCompanyMap.has(normalized)) {
      found.push({ target: company, tamName: tamCompanyMap.get(normalized)!, method: 'exact' });
      continue;
    }

    // Partial match - check if target is contained in TAM name or vice versa
    let matched = false;
    for (const [tamNorm, tamOrig] of tamCompanyMap) {
      if (tamNorm.includes(normalized) || normalized.includes(tamNorm)) {
        if (normalized.length >= 3 && tamNorm.length >= 3) { // Avoid tiny matches
          found.push({ target: company, tamName: tamOrig, method: 'partial' });
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      missing.push(company);
    }
  }

  console.log('=== RESULTS ===');
  console.log(`Found: ${found.length}/${allCompanies.length} (${(found.length/allCompanies.length*100).toFixed(1)}%)`);
  console.log(`Missing: ${missing.length}/${allCompanies.length}\n`);

  // Breakdown by category
  const categories = [
    { name: 'Enterprise Finance', start: 0, count: 50 },
    { name: 'Digital Assets', start: 50, count: 20 },
    { name: 'Neobanks', start: 70, count: 35 },
    { name: 'Insurance Fintechs', start: 105, count: 30 },
    { name: 'Wealth Management', start: 135, count: 50 },
    { name: 'Payments', start: 185, count: 75 },
    { name: 'Alternative Finance', start: 260, count: 40 }
  ];

  console.log('=== BREAKDOWN BY CATEGORY ===');
  for (const cat of categories) {
    const categoryCompanies = allCompanies.slice(cat.start, cat.start + cat.count);
    const categoryFound = found.filter(f => categoryCompanies.includes(f.target));
    console.log(`${cat.name}: ${categoryFound.length}/${cat.count} (${(categoryFound.length/cat.count*100).toFixed(0)}%)`);
  }

  if (missing.length > 0) {
    console.log('\n=== MISSING COMPANIES ===');
    for (const m of missing) {
      console.log(`  - ${m}`);
    }
  }

  // Show sample matches
  console.log('\n=== SAMPLE EXACT MATCHES (first 20) ===');
  const exactMatches = found.filter(f => f.method === 'exact').slice(0, 20);
  for (const f of exactMatches) {
    console.log(`  "${f.target}" -> "${f.tamName}"`);
  }
}

main().catch(console.error);
