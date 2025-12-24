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
  'Común', 'Dave', 'EQ Bank', 'Fondeadora', 'Inter', 'KakaoBank', 'Klar', 'Koho',
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

const tamResultsPath = path.join(__dirname, '../data/tam-expansion-v2-results.csv');

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function main() {
  const tamContent = fs.readFileSync(tamResultsPath, 'utf-8');

  // Build a map of all company names in TAM results (normalized -> original)
  const tamCompanyMap = new Map<string, string>();

  // Parse CSV properly handling quoted fields
  const lines = tamContent.split('\n');
  const header = lines[0];

  // Find company_name column index
  const headerParts = header.split(',');
  const nameIdx = headerParts.findIndex(h => h === 'company_name');

  console.log(`Company name column index: ${nameIdx}`);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Simple extraction - company_name is column 1 (index 1)
    const match = line.match(/^[^,]*,([^,]*)/);
    if (match && match[1]) {
      const name = match[1].replace(/^"|"$/g, '').trim();
      if (name) {
        tamCompanyMap.set(normalizeForMatch(name), name);
      }
    }
  }

  console.log(`Total companies in TAM results: ${tamCompanyMap.size}\n`);

  // Check each company
  const found: { target: string; tamName: string }[] = [];
  const missing: string[] = [];

  for (const company of allCompanies) {
    const normalized = normalizeForMatch(company);

    // Exact match
    if (tamCompanyMap.has(normalized)) {
      found.push({ target: company, tamName: tamCompanyMap.get(normalized)! });
      continue;
    }

    // Partial match - check if target is contained in TAM name or vice versa
    let matched = false;
    for (const [tamNorm, tamOrig] of tamCompanyMap) {
      if (tamNorm.includes(normalized) || normalized.includes(tamNorm)) {
        if (normalized.length >= 3 && tamNorm.length >= 3) { // Avoid tiny matches
          found.push({ target: company, tamName: tamOrig });
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      missing.push(company);
    }
  }

  console.log('=== FOUND IN TAM RESULTS ===');
  console.log(`Count: ${found.length}/${allCompanies.length}\n`);

  if (missing.length > 0) {
    console.log('=== MISSING FROM TAM RESULTS ===');
    for (const m of missing) {
      console.log(`  - ${m}`);
    }
  } else {
    console.log('✅ ALL 300 COMPANIES FOUND IN TAM OUTPUT');
  }

  // Show sample of matches
  console.log('\n=== SAMPLE MATCHES (first 20) ===');
  for (const f of found.slice(0, 20)) {
    console.log(`  "${f.target}" → "${f.tamName}"`);
  }
}

main().catch(console.error);
