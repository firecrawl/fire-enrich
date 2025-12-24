import * as fs from 'fs';
import * as path from 'path';

// Companies from the 7 CSV files to verify
const companyLists: { category: string; companies: string[] }[] = [
  {
    category: 'Enterprise Finance',
    companies: [
      'ADVANCE AI', 'Airwallex', 'Alloy', 'Aspire', 'Backbase', 'BILL', 'BioCatch', 'Brex',
      'Candex', 'Capitolis', 'ClearBank', 'ComplyAdvantage', 'Datasnipper', 'Finastra',
      'Finnovating', 'FIS', 'FloQast', 'FreshBooks', 'Galileo', 'GlossGenius', 'Gusto',
      'Intuit', 'Justt', 'Kyriba', 'MX Technologies', 'Navan', 'NCino', 'Nova Credit',
      'PayFit', 'Personetics', 'Plaid', 'Pleo', 'Prestatech', 'Q2', 'SEON', 'Socure',
      'Soldo', 'Spendesk', 'Sumsub', 'SymphonyAI', 'Temenos', 'Thought Machine', 'Tipalti',
      'Trovata', 'TrueLayer', 'Xero', 'Yapily', 'Zafin', 'Zest AI', 'Zip'
    ]
  },
  {
    category: 'Digital Assets',
    companies: [
      'Binance', 'BitGo', 'Blockdaemon', 'Chainalysis', 'Coinbase', 'CoinTracker', 'Consensys',
      'Figment', 'Finery Markets', 'Fireblocks', 'Galaxy', 'Ledger', 'Magic Eden', 'OKX',
      'OpenSea', 'OSL Group', 'StraitsX', 'Turnkey', 'VGS', 'Zodia Custody'
    ]
  },
  {
    category: 'Neobanks',
    companies: [
      'Agibank', 'Allica Bank', 'Atom bank', 'Au Jibun Bank', 'Bunq', 'C6 Bank', 'Chime',
      'Común', 'Dave', 'EQ Bank', 'Fondeadora', 'Inter', 'KakaoBank', 'Klar', 'Koho',
      'Lunar', 'Mercury', 'Monzo', 'N26', 'Neo Financial', 'Neon', 'Nest Bank', 'Niyo',
      'Nubank', 'Revolut', 'SoFi', 'Starling Bank', 'Step', 'Stori', 'TBC Uzbekistan',
      'Tide', 'Uala', 'Upgrade', 'Varo Bank', 'Zopa Bank'
    ]
  },
  {
    category: 'Insurance Fintechs',
    companies: [
      '180 Seguros', 'Accelerant', 'Acko General Insurance', 'Alan', 'Blink Parametric',
      'Digit Insurance', 'Entsia', 'EvolutionIQ', 'Guidewire Software', 'Hi Marley', 'Hippo',
      'Hyperexponential', 'Insurify', 'Ki', 'Kin Insurance', 'Lemonade', 'Mylo',
      'Next Insurance', 'Oscar Insurance', 'Peak3', 'PolicyBazaar', 'Qoala', 'RenewBuy',
      'Roadzen', 'Root Insurance', 'Sapiens International', 'Snapsheet', 'Veracity Insurance Solutions',
      'Vitesse', 'Wakam'
    ]
  },
  {
    category: 'Wealth Management',
    companies: [
      'Acorns', 'Addepar', 'Albert', 'AngelList', 'Atticus', 'Betterment', 'Bilt', 'Bitpanda',
      'Check24', 'Clear Street', 'Clearwater Analytics', 'Cleo AI', 'Docupace', 'DriveWealth',
      'Empower', 'Endowus', 'EToro', 'Fundrise', 'GTN', 'Hakbah', 'ICapital',
      'Interactive Brokers', 'LendingTree', 'Monarch Money', 'Moneybox', 'Moneyfarm',
      'MoneyLion', 'MoneySuperMarket', 'NerdWallet', 'Oportun', 'PiggyVest', 'Plus500',
      'Pulley', 'Quicken', 'Raisin', 'Raiz', 'Robinhood', 'Scalable Capital', 'Self Financial',
      'Smart', 'StashAway', 'Taxfix', 'Tiger Brokers', 'Trade Republic', 'Trading 212',
      'Uswitch', 'Vestwell', 'Wealthfront', 'Wealthsimple', 'Webull'
    ]
  },
  {
    category: 'Payments',
    companies: [
      'ACI Worldwide', 'Adyen', 'AffiniPay', 'Affirm', 'Ant Group', 'Ascend Money', 'Balance',
      'BharatPe', 'Bkash', 'BLIK', 'Block', 'Checkout.com', 'Convera', 'DANA', 'Fiserv',
      'Freecharge', 'GoTo', 'Grab Financial Group', 'IBanFirst', 'Imprint', 'Interswitch',
      'Klarna', 'Lianlian DigiTech', 'Lightspeed', 'Marqeta', 'Mastercard', 'Mollie',
      'Moniepoint', 'MyFawry', 'Nexi', 'Nium', 'Nuvei', 'Oceanpayment', 'Okoora', 'One Inc',
      'Opay', 'PalmPay', 'Paymentus', 'Paymob', 'Payoneer', 'PayPal', 'Paysafe', 'Paystand',
      'Paytm', 'PayU', 'PhonePe', 'Pliant', 'Priority', 'Rapyd', 'Razorpay', 'Remitly',
      'Ripple', 'Sezzle', 'Sipay', 'Stone', 'Stripe', 'SumUp', 'SUNRATE', 'Tazapay',
      'Tencent', 'TerraPay', 'Thunes', 'Toast', 'Toss', 'Trustly', 'Tyro', 'Visa',
      'Wave Money', 'Wise', 'Ant International', 'Yoco', 'YouTrip', 'Yuno', 'Zaver', 'Zilch'
    ]
  },
  {
    category: 'Alternative Finance',
    companies: [
      'Akulaku', 'Aye Finance', 'Best Egg', 'Biz2Credit', 'Bluevine', 'Bondora', 'C2FO',
      'CapBay', 'Collin Crowdfund', 'Companisto', 'Crowd Street', 'Earnest', 'Enova',
      'Fundbox', 'Funding Circle', 'Funding Societies', 'Happy Money', 'InCred', 'Iuvo group',
      'Iwoca', 'Kueski', 'Liberis', 'LoanDepot', 'MicroVentures', 'M-KOPA', 'PeerBerry',
      'Plenti', 'Prosper', 'Raize', 'SellersFi', 'Sun Finance', 'Tala', 'Teylor',
      'UnaFinancial', 'Upstart', 'Urbanitae', 'Wayflyer', 'WeLend', 'YouLend', 'Yubi'
    ]
  }
];

// Read TAM results
const tamResultsPath = path.join(__dirname, '../data/tam-expansion-v2-results.csv');

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
    .trim();
}

async function main() {
  // Read TAM results
  const tamContent = fs.readFileSync(tamResultsPath, 'utf-8');
  const lines = tamContent.split('\n');

  // Parse header
  const header = lines[0].split(',');
  const nameIndex = header.findIndex(h => h.includes('linkedin_company_name') || h.includes('company_name'));
  const domainIndex = header.findIndex(h => h.includes('company_website_domain') || h.includes('website'));

  console.log(`Header: name index=${nameIndex}, domain index=${domainIndex}`);
  console.log(`First few headers: ${header.slice(0, 10).join(', ')}`);

  // Build set of company names and domains from TAM results
  const tamCompanyNames = new Set<string>();
  const tamDomains = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    // Simple CSV parsing (may need improvement for quoted fields)
    const parts = lines[i].split(',');

    if (nameIndex >= 0 && parts[nameIndex]) {
      const name = parts[nameIndex].replace(/^"/, '').replace(/"$/, '');
      tamCompanyNames.add(normalizeCompanyName(name));
    }

    if (domainIndex >= 0 && parts[domainIndex]) {
      const domain = parts[domainIndex].replace(/^"/, '').replace(/"$/, '').toLowerCase();
      tamDomains.add(domain);
    }
  }

  console.log(`\nLoaded ${tamCompanyNames.size} company names and ${tamDomains.size} domains from TAM results\n`);

  // Check each company list
  const allMissing: { category: string; company: string }[] = [];
  const allFound: { category: string; company: string }[] = [];

  for (const list of companyLists) {
    console.log(`\n=== ${list.category} ===`);
    const missing: string[] = [];
    const found: string[] = [];

    for (const company of list.companies) {
      const normalized = normalizeCompanyName(company);

      // Check if in TAM results by name
      if (tamCompanyNames.has(normalized)) {
        found.push(company);
        allFound.push({ category: list.category, company });
      } else {
        // Check partial match
        let partialMatch = false;
        for (const tamName of tamCompanyNames) {
          if (tamName.includes(normalized) || normalized.includes(tamName)) {
            found.push(company);
            allFound.push({ category: list.category, company });
            partialMatch = true;
            break;
          }
        }

        if (!partialMatch) {
          missing.push(company);
          allMissing.push({ category: list.category, company });
        }
      }
    }

    console.log(`Found: ${found.length}/${list.companies.length}`);
    if (missing.length > 0) {
      console.log(`Missing: ${missing.join(', ')}`);
    }
  }

  console.log('\n\n========== SUMMARY ==========');
  console.log(`Total companies to verify: ${companyLists.reduce((sum, l) => sum + l.companies.length, 0)}`);
  console.log(`Found in TAM: ${allFound.length}`);
  console.log(`Missing from TAM: ${allMissing.length}`);

  if (allMissing.length > 0) {
    console.log('\n=== ALL MISSING COMPANIES ===');
    const byCategory: { [key: string]: string[] } = {};
    for (const m of allMissing) {
      if (!byCategory[m.category]) byCategory[m.category] = [];
      byCategory[m.category].push(m.company);
    }

    for (const [cat, companies] of Object.entries(byCategory)) {
      console.log(`\n${cat}:`);
      for (const c of companies) {
        console.log(`  - ${c}`);
      }
    }
  }
}

main().catch(console.error);
