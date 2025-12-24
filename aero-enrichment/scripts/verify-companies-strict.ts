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

function normalizeStrict(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function main() {
  const tamContent = fs.readFileSync(tamResultsPath, 'utf-8');
  const lines = tamContent.split('\n');

  // Build set of normalized company names
  const tamNames = new Set<string>();
  const tamNamesOriginal = new Map<string, string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Extract company_name (column index 1)
    const match = line.match(/^[^,]*,([^,]*)/);
    if (match && match[1]) {
      const name = match[1].replace(/^"|"$/g, '').trim();
      if (name) {
        const normalized = normalizeStrict(name);
        tamNames.add(normalized);
        tamNamesOriginal.set(normalized, name);
      }
    }
  }

  console.log(`Total unique companies in TAM output: ${tamNames.size}\n`);

  const found: { target: string; tamName: string }[] = [];
  const missing: string[] = [];

  for (const company of allCompanies) {
    const normalized = normalizeStrict(company);

    // Only exact match
    if (tamNames.has(normalized)) {
      found.push({ target: company, tamName: tamNamesOriginal.get(normalized)! });
    } else {
      missing.push(company);
    }
  }

  console.log(`=== RESULTS ===`);
  console.log(`Found (exact match): ${found.length}/${allCompanies.length}`);
  console.log(`Missing: ${missing.length}/${allCompanies.length}\n`);

  if (found.length > 0) {
    console.log('=== FOUND IN TAM OUTPUT (exact matches) ===');
    for (const f of found) {
      console.log(`  ✅ ${f.target} → ${f.tamName}`);
    }
  }

  if (missing.length > 0) {
    console.log('\n=== MISSING FROM TAM OUTPUT ===');
    for (const m of missing) {
      console.log(`  ❌ ${m}`);
    }
  }
}

main().catch(console.error);
