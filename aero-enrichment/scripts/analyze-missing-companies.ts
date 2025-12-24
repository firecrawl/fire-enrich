// Analyze why companies are missing from TAM results

interface CompanyInfo {
  name: string;
  city: string;
  country: string;
  category: string;
}

// Companies with their countries from the 7 CSV files
const allCompanies: CompanyInfo[] = [
  // Enterprise Finance
  { name: 'ADVANCE AI', city: 'Singapore', country: 'Singapore', category: 'Enterprise Finance' },
  { name: 'Airwallex', city: 'Singapore', country: 'Singapore', category: 'Enterprise Finance' },
  { name: 'Alloy', city: 'New York', country: 'United States', category: 'Enterprise Finance' },
  { name: 'Aspire', city: 'Singapore', country: 'Singapore', category: 'Enterprise Finance' },
  { name: 'Backbase', city: 'Amsterdam', country: 'The Netherlands', category: 'Enterprise Finance' },
  { name: 'BILL', city: 'San Jose', country: 'United States', category: 'Enterprise Finance' },
  { name: 'BioCatch', city: 'Tel Aviv', country: 'Israel', category: 'Enterprise Finance' },
  { name: 'Brex', city: 'San Francisco', country: 'United States', category: 'Enterprise Finance' },
  { name: 'Candex', city: 'New York', country: 'United States', category: 'Enterprise Finance' },
  { name: 'Capitolis', city: 'New York', country: 'United States', category: 'Enterprise Finance' },
  { name: 'ClearBank', city: 'London', country: 'United Kingdom', category: 'Enterprise Finance' },
  { name: 'ComplyAdvantage', city: 'London', country: 'United Kingdom', category: 'Enterprise Finance' },
  { name: 'Datasnipper', city: 'Amsterdam', country: 'The Netherlands', category: 'Enterprise Finance' },
  { name: 'Finastra', city: 'London', country: 'United Kingdom', category: 'Enterprise Finance' },
  { name: 'Finnovating', city: 'Dover / Madrid', country: 'United States / Spain', category: 'Enterprise Finance' },
  { name: 'FIS', city: 'Jacksonville', country: 'United States', category: 'Enterprise Finance' },
  { name: 'FloQast', city: 'Sherman Oaks', country: 'United States', category: 'Enterprise Finance' },
  { name: 'FreshBooks', city: 'Toronto', country: 'Canada', category: 'Enterprise Finance' },
  { name: 'Galileo', city: 'Sandy', country: 'United States', category: 'Enterprise Finance' },
  { name: 'GlossGenius', city: 'New York', country: 'United States', category: 'Enterprise Finance' },
  { name: 'Gusto', city: 'San Francisco', country: 'United States', category: 'Enterprise Finance' },
  { name: 'Intuit', city: 'Mountain View', country: 'United States', category: 'Enterprise Finance' },
  { name: 'Justt', city: 'Tel Aviv', country: 'Israel', category: 'Enterprise Finance' },
  { name: 'Kyriba', city: 'San Diego', country: 'United States', category: 'Enterprise Finance' },
  { name: 'MX Technologies', city: 'Lehi', country: 'United States', category: 'Enterprise Finance' },
  { name: 'Navan', city: 'Palo Alto', country: 'United States', category: 'Enterprise Finance' },
  { name: 'NCino', city: 'Wilmington', country: 'United States', category: 'Enterprise Finance' },
  { name: 'Nova Credit', city: 'San Francisco', country: 'United States', category: 'Enterprise Finance' },
  { name: 'PayFit', city: 'Paris', country: 'France', category: 'Enterprise Finance' },
  { name: 'Personetics', city: 'New York', country: 'United States', category: 'Enterprise Finance' },
  { name: 'Plaid', city: 'San Francisco', country: 'United States', category: 'Enterprise Finance' },
  { name: 'Pleo', city: 'Copenhagen', country: 'Denmark', category: 'Enterprise Finance' },
  { name: 'Prestatech', city: 'Berlin', country: 'Germany', category: 'Enterprise Finance' },
  { name: 'Q2', city: 'Austin', country: 'United States', category: 'Enterprise Finance' },
  { name: 'SEON', city: 'Austin', country: 'United States', category: 'Enterprise Finance' },
  { name: 'Socure', city: 'Incline Village', country: 'United States', category: 'Enterprise Finance' },
  { name: 'Soldo', city: 'London', country: 'United Kingdom', category: 'Enterprise Finance' },
  { name: 'Spendesk', city: 'Paris', country: 'France', category: 'Enterprise Finance' },
  { name: 'Sumsub', city: 'London', country: 'United Kingdom', category: 'Enterprise Finance' },
  { name: 'SymphonyAI', city: 'Palo Alto', country: 'United States', category: 'Enterprise Finance' },
  { name: 'Temenos', city: 'Geneva', country: 'Switzerland', category: 'Enterprise Finance' },
  { name: 'Thought Machine', city: 'London', country: 'United Kingdom', category: 'Enterprise Finance' },
  { name: 'Tipalti', city: 'Foster City', country: 'United States', category: 'Enterprise Finance' },
  { name: 'Trovata', city: 'San Diego', country: 'United States', category: 'Enterprise Finance' },
  { name: 'TrueLayer', city: 'London', country: 'United Kingdom', category: 'Enterprise Finance' },
  { name: 'Xero', city: 'Wellington', country: 'New Zealand', category: 'Enterprise Finance' },
  { name: 'Yapily', city: 'London', country: 'United Kingdom', category: 'Enterprise Finance' },
  { name: 'Zafin', city: 'Vancouver', country: 'Canada', category: 'Enterprise Finance' },
  { name: 'Zest AI', city: 'Burbank', country: 'United States', category: 'Enterprise Finance' },
  { name: 'Zip', city: 'San Francisco', country: 'United States', category: 'Enterprise Finance' },

  // Digital Assets
  { name: 'Binance', city: 'Decentralized', country: 'Decentralized', category: 'Digital Assets' },
  { name: 'BitGo', city: 'Palo Alto', country: 'United States', category: 'Digital Assets' },
  { name: 'Blockdaemon', city: 'Los Angeles', country: 'United States', category: 'Digital Assets' },
  { name: 'Chainalysis', city: 'New York', country: 'United States', category: 'Digital Assets' },
  { name: 'Coinbase', city: 'Decentralized', country: 'Decentralized', category: 'Digital Assets' },
  { name: 'CoinTracker', city: 'San Francisco', country: 'United States', category: 'Digital Assets' },
  { name: 'Consensys', city: 'Fort Worth', country: 'United States', category: 'Digital Assets' },
  { name: 'Figment', city: 'Toronto', country: 'Canada', category: 'Digital Assets' },
  { name: 'Finery Markets', city: 'Limassol', country: 'Cyprus', category: 'Digital Assets' },
  { name: 'Fireblocks', city: 'New York', country: 'United States', category: 'Digital Assets' },
  { name: 'Galaxy', city: 'New York', country: 'United States', category: 'Digital Assets' },
  { name: 'Ledger', city: 'Paris', country: 'France', category: 'Digital Assets' },
  { name: 'Magic Eden', city: 'San Francisco', country: 'United States', category: 'Digital Assets' },
  { name: 'OKX', city: 'San Jose', country: 'United States', category: 'Digital Assets' },
  { name: 'OpenSea', city: 'New York', country: 'United States', category: 'Digital Assets' },
  { name: 'OSL Group', city: 'Hong Kong', country: 'SAR, China', category: 'Digital Assets' },
  { name: 'StraitsX', city: 'Singapore', country: 'Singapore', category: 'Digital Assets' },
  { name: 'Turnkey', city: 'New York', country: 'United States', category: 'Digital Assets' },
  { name: 'VGS', city: 'San Francisco', country: 'United States', category: 'Digital Assets' },
  { name: 'Zodia Custody', city: 'London', country: 'United Kingdom', category: 'Digital Assets' },

  // Neobanks
  { name: 'Agibank', city: 'Campinas', country: 'Brazil', category: 'Neobanks' },
  { name: 'Allica Bank', city: 'London', country: 'United Kingdom', category: 'Neobanks' },
  { name: 'Atom bank', city: 'Durham', country: 'United Kingdom', category: 'Neobanks' },
  { name: 'Au Jibun Bank', city: 'Tokyo', country: 'Japan', category: 'Neobanks' },
  { name: 'Bunq', city: 'Amsterdam', country: 'The Netherlands', category: 'Neobanks' },
  { name: 'C6 Bank', city: 'Sao Paulo', country: 'Brazil', category: 'Neobanks' },
  { name: 'Chime', city: 'San Francisco', country: 'United States', category: 'Neobanks' },
  { name: 'Común', city: 'New York', country: 'United States', category: 'Neobanks' },
  { name: 'Dave', city: 'Los Angeles', country: 'United States', category: 'Neobanks' },
  { name: 'EQ Bank', city: 'Toronto', country: 'Canada', category: 'Neobanks' },
  { name: 'Fondeadora', city: 'Mexico City', country: 'Mexico', category: 'Neobanks' },
  { name: 'Inter', city: 'Belo Horizonte', country: 'Brazil', category: 'Neobanks' },
  { name: 'KakaoBank', city: 'Seongnam-si', country: 'South Korea', category: 'Neobanks' },
  { name: 'Klar', city: 'Mexico City', country: 'Mexico', category: 'Neobanks' },
  { name: 'Koho', city: 'Vancouver', country: 'Canada', category: 'Neobanks' },
  { name: 'Lunar', city: 'Copenhagen', country: 'Denmark', category: 'Neobanks' },
  { name: 'Mercury', city: 'San Francisco', country: 'United States', category: 'Neobanks' },
  { name: 'Monzo', city: 'London', country: 'United Kingdom', category: 'Neobanks' },
  { name: 'N26', city: 'Berlin', country: 'Germany', category: 'Neobanks' },
  { name: 'Neo Financial', city: 'Calgary', country: 'Canada', category: 'Neobanks' },
  { name: 'Neon', city: 'Sao Paulo', country: 'Brazil', category: 'Neobanks' },
  { name: 'Nest Bank', city: 'Warsaw', country: 'Poland', category: 'Neobanks' },
  { name: 'Niyo', city: 'Bangalore', country: 'India', category: 'Neobanks' },
  { name: 'Nubank', city: 'Sao Paulo', country: 'Brazil', category: 'Neobanks' },
  { name: 'Revolut', city: 'London', country: 'United Kingdom', category: 'Neobanks' },
  { name: 'SoFi', city: 'San Francisco', country: 'United States', category: 'Neobanks' },
  { name: 'Starling Bank', city: 'London', country: 'United Kingdom', category: 'Neobanks' },
  { name: 'Step', city: 'Palo Alto', country: 'United States', category: 'Neobanks' },
  { name: 'Stori', city: 'Mexico City', country: 'Mexico', category: 'Neobanks' },
  { name: 'TBC Uzbekistan', city: 'Tashkent', country: 'Uzbekistan', category: 'Neobanks' },
  { name: 'Tide', city: 'London', country: 'United Kingdom', category: 'Neobanks' },
  { name: 'Uala', city: 'Buenos Aires', country: 'Argentina', category: 'Neobanks' },
  { name: 'Upgrade', city: 'San Francisco', country: 'United States', category: 'Neobanks' },
  { name: 'Varo Bank', city: 'San Francisco', country: 'United States', category: 'Neobanks' },
  { name: 'Zopa Bank', city: 'London', country: 'United Kingdom', category: 'Neobanks' },

  // Insurance Fintechs
  { name: '180 Seguros', city: 'Sao Paulo', country: 'Brazil', category: 'Insurance' },
  { name: 'Accelerant', city: 'Atlanta', country: 'United States', category: 'Insurance' },
  { name: 'Acko General Insurance', city: 'Bangalore', country: 'India', category: 'Insurance' },
  { name: 'Alan', city: 'Paris', country: 'France', category: 'Insurance' },
  { name: 'Blink Parametric', city: 'Cork', country: 'Ireland', category: 'Insurance' },
  { name: 'Digit Insurance', city: 'Bangalore', country: 'India', category: 'Insurance' },
  { name: 'Entsia', city: 'Sydney', country: 'Australia', category: 'Insurance' },
  { name: 'EvolutionIQ', city: 'New York', country: 'United States', category: 'Insurance' },
  { name: 'Guidewire Software', city: 'San Mateo', country: 'United States', category: 'Insurance' },
  { name: 'Hi Marley', city: 'Boston', country: 'United States', category: 'Insurance' },
  { name: 'Hippo', city: 'Palo Alto', country: 'United States', category: 'Insurance' },
  { name: 'Hyperexponential', city: 'London', country: 'United Kingdom', category: 'Insurance' },
  { name: 'Insurify', city: 'Cambridge', country: 'United States', category: 'Insurance' },
  { name: 'Ki', city: 'London', country: 'United Kingdom', category: 'Insurance' },
  { name: 'Kin Insurance', city: 'Chicago', country: 'United States', category: 'Insurance' },
  { name: 'Lemonade', city: 'New York', country: 'United States', category: 'Insurance' },
  { name: 'Mylo', city: 'Kansas City', country: 'United States', category: 'Insurance' },
  { name: 'Next Insurance', city: 'Palo Alto', country: 'United States', category: 'Insurance' },
  { name: 'Oscar Insurance', city: 'New York', country: 'United States', category: 'Insurance' },
  { name: 'Peak3', city: 'Singapore', country: 'Singapore', category: 'Insurance' },
  { name: 'PolicyBazaar', city: 'Gurgaon', country: 'India', category: 'Insurance' },
  { name: 'Qoala', city: 'Jakarta', country: 'Indonesia', category: 'Insurance' },
  { name: 'RenewBuy', city: 'Gurgaon', country: 'India', category: 'Insurance' },
  { name: 'Roadzen', city: 'Burlingame', country: 'United States', category: 'Insurance' },
  { name: 'Root Insurance', city: 'Columbus', country: 'United States', category: 'Insurance' },
  { name: 'Sapiens International', city: 'Holon', country: 'Israel', category: 'Insurance' },
  { name: 'Snapsheet', city: 'Chicago', country: 'United States', category: 'Insurance' },
  { name: 'Veracity Insurance Solutions', city: 'Pleasant Grove', country: 'United States', category: 'Insurance' },
  { name: 'Vitesse', city: 'London', country: 'United Kingdom', category: 'Insurance' },
  { name: 'Wakam', city: 'Paris', country: 'France', category: 'Insurance' },

  // Wealth Management
  { name: 'Acorns', city: 'Irvine', country: 'United States', category: 'Wealth' },
  { name: 'Addepar', city: 'New York', country: 'United States', category: 'Wealth' },
  { name: 'Albert', city: 'Los Angeles', country: 'United States', category: 'Wealth' },
  { name: 'AngelList', city: 'San Francisco', country: 'United States', category: 'Wealth' },
  { name: 'Atticus', city: 'Raleigh', country: 'United States', category: 'Wealth' },
  { name: 'Betterment', city: 'New York', country: 'United States', category: 'Wealth' },
  { name: 'Bilt', city: 'New York', country: 'United States', category: 'Wealth' },
  { name: 'Bitpanda', city: 'Vienna', country: 'Austria', category: 'Wealth' },
  { name: 'Check24', city: 'Munich', country: 'Germany', category: 'Wealth' },
  { name: 'Clear Street', city: 'New York', country: 'United States', category: 'Wealth' },
  { name: 'Clearwater Analytics', city: 'Boise', country: 'United States', category: 'Wealth' },
  { name: 'Cleo AI', city: 'London', country: 'United Kingdom', category: 'Wealth' },
  { name: 'Docupace', city: 'Culver City', country: 'United States', category: 'Wealth' },
  { name: 'DriveWealth', city: 'New York', country: 'United States', category: 'Wealth' },
  { name: 'Empower', city: 'Greenwood Village', country: 'United States', category: 'Wealth' },
  { name: 'Endowus', city: 'Singapore', country: 'Singapore', category: 'Wealth' },
  { name: 'EToro', city: 'Tel Aviv', country: 'Israel', category: 'Wealth' },
  { name: 'Fundrise', city: 'Washington', country: 'United States', category: 'Wealth' },
  { name: 'GTN', city: 'Dubai', country: 'United Arab Emirates', category: 'Wealth' },
  { name: 'Hakbah', city: 'Riyadh', country: 'Saudi Arabia', category: 'Wealth' },
  { name: 'ICapital', city: 'New York', country: 'United States', category: 'Wealth' },
  { name: 'Interactive Brokers', city: 'Greenwich', country: 'United States', category: 'Wealth' },
  { name: 'LendingTree', city: 'Charlotte', country: 'United States', category: 'Wealth' },
  { name: 'Monarch Money', city: 'San Francisco', country: 'United States', category: 'Wealth' },
  { name: 'Moneybox', city: 'London', country: 'United Kingdom', category: 'Wealth' },
  { name: 'Moneyfarm', city: 'London', country: 'United Kingdom', category: 'Wealth' },
  { name: 'MoneyLion', city: 'New York', country: 'United States', category: 'Wealth' },
  { name: 'MoneySuperMarket', city: 'Ewloe', country: 'United Kingdom', category: 'Wealth' },
  { name: 'NerdWallet', city: 'San Francisco', country: 'United States', category: 'Wealth' },
  { name: 'Oportun', city: 'San Carlos', country: 'United States', category: 'Wealth' },
  { name: 'PiggyVest', city: 'Lagos', country: 'Nigeria', category: 'Wealth' },
  { name: 'Plus500', city: 'Haifa', country: 'Israel', category: 'Wealth' },
  { name: 'Pulley', city: 'San Francisco', country: 'United States', category: 'Wealth' },
  { name: 'Quicken', city: 'Menlo Park', country: 'United States', category: 'Wealth' },
  { name: 'Raisin', city: 'Berlin', country: 'Germany', category: 'Wealth' },
  { name: 'Raiz', city: 'Sydney', country: 'Australia', category: 'Wealth' },
  { name: 'Robinhood', city: 'Menlo Park', country: 'United States', category: 'Wealth' },
  { name: 'Scalable Capital', city: 'Munich', country: 'Germany', category: 'Wealth' },
  { name: 'Self Financial', city: 'Austin', country: 'United States', category: 'Wealth' },
  { name: 'Smart', city: 'London', country: 'United Kingdom', category: 'Wealth' },
  { name: 'StashAway', city: 'Singapore', country: 'Singapore', category: 'Wealth' },
  { name: 'Taxfix', city: 'Berlin', country: 'Germany', category: 'Wealth' },
  { name: 'Tiger Brokers', city: 'Singapore', country: 'Singapore', category: 'Wealth' },
  { name: 'Trade Republic', city: 'Berlin', country: 'Germany', category: 'Wealth' },
  { name: 'Trading 212', city: 'London', country: 'United Kingdom', category: 'Wealth' },
  { name: 'Uswitch', city: 'London', country: 'United Kingdom', category: 'Wealth' },
  { name: 'Vestwell', city: 'New York', country: 'United States', category: 'Wealth' },
  { name: 'Wealthfront', city: 'Palo Alto', country: 'United States', category: 'Wealth' },
  { name: 'Wealthsimple', city: 'Toronto', country: 'Canada', category: 'Wealth' },
  { name: 'Webull', city: 'St Petersburg', country: 'United States', category: 'Wealth' },

  // Payments
  { name: 'ACI Worldwide', city: 'Omaha', country: 'United States', category: 'Payments' },
  { name: 'Adyen', city: 'Amsterdam', country: 'The Netherlands', category: 'Payments' },
  { name: 'AffiniPay', city: 'Austin', country: 'United States', category: 'Payments' },
  { name: 'Affirm', city: 'San Francisco', country: 'United States', category: 'Payments' },
  { name: 'Ant Group', city: 'Hangzhou', country: 'China', category: 'Payments' },
  { name: 'Ascend Money', city: 'Bangkok', country: 'Thailand', category: 'Payments' },
  { name: 'Balance', city: 'New York', country: 'United States', category: 'Payments' },
  { name: 'BharatPe', city: 'Gurugram', country: 'India', category: 'Payments' },
  { name: 'Bkash', city: 'Dhaka', country: 'Bangladesh', category: 'Payments' },
  { name: 'BLIK', city: 'Warsaw', country: 'Poland', category: 'Payments' },
  { name: 'Block', city: 'Oakland', country: 'United States', category: 'Payments' },
  { name: 'Checkout.com', city: 'London', country: 'United Kingdom', category: 'Payments' },
  { name: 'Convera', city: 'Seattle', country: 'United States', category: 'Payments' },
  { name: 'DANA', city: 'Jakarta', country: 'Indonesia', category: 'Payments' },
  { name: 'Fiserv', city: 'Milwaukee', country: 'United States', category: 'Payments' },
  { name: 'Freecharge', city: 'Gurugram', country: 'India', category: 'Payments' },
  { name: 'GoTo', city: 'Jakarta', country: 'Indonesia', category: 'Payments' },
  { name: 'Grab Financial Group', city: 'Singapore', country: 'Singapore', category: 'Payments' },
  { name: 'IBanFirst', city: 'Brussels', country: 'Belgium', category: 'Payments' },
  { name: 'Imprint', city: 'New York', country: 'United States', category: 'Payments' },
  { name: 'Interswitch', city: 'Lagos', country: 'Nigeria', category: 'Payments' },
  { name: 'Klarna', city: 'Stockholm', country: 'Sweden', category: 'Payments' },
  { name: 'Lianlian DigiTech', city: 'Hangzhou', country: 'China', category: 'Payments' },
  { name: 'Lightspeed', city: 'Quebec', country: 'Canada', category: 'Payments' },
  { name: 'Marqeta', city: 'Oakland', country: 'United States', category: 'Payments' },
  { name: 'Mastercard', city: 'Purchase', country: 'United States', category: 'Payments' },
  { name: 'Mollie', city: 'Amsterdam', country: 'The Netherlands', category: 'Payments' },
  { name: 'Moniepoint', city: 'London', country: 'United Kingdom', category: 'Payments' },
  { name: 'MyFawry', city: 'Cairo', country: 'Egypt', category: 'Payments' },
  { name: 'Nexi', city: 'Milan', country: 'Italy', category: 'Payments' },
  { name: 'Nium', city: 'San Francisco', country: 'United States', category: 'Payments' },
  { name: 'Nuvei', city: 'Montreal', country: 'Canada', category: 'Payments' },
  { name: 'Oceanpayment', city: 'Hong Kong', country: 'SAR, China', category: 'Payments' },
  { name: 'Okoora', city: 'Bnei Brak', country: 'Israel', category: 'Payments' },
  { name: 'One Inc', city: 'Folsom', country: 'United States', category: 'Payments' },
  { name: 'Opay', city: 'Lagos', country: 'Nigeria', category: 'Payments' },
  { name: 'PalmPay', city: 'Lagos', country: 'Nigeria', category: 'Payments' },
  { name: 'Paymentus', city: 'Charlotte', country: 'United States', category: 'Payments' },
  { name: 'Paymob', city: 'Cairo', country: 'Egypt', category: 'Payments' },
  { name: 'Payoneer', city: 'New York', country: 'United States', category: 'Payments' },
  { name: 'PayPal', city: 'San Jose', country: 'United States', category: 'Payments' },
  { name: 'Paysafe', city: 'London', country: 'United Kingdom', category: 'Payments' },
  { name: 'Paystand', city: 'Santa Cruz', country: 'United States', category: 'Payments' },
  { name: 'Paytm', city: 'Noida', country: 'India', category: 'Payments' },
  { name: 'PayU', city: 'Amsterdam', country: 'The Netherlands', category: 'Payments' },
  { name: 'PhonePe', city: 'Bengalore', country: 'India', category: 'Payments' },
  { name: 'Pliant', city: 'Berlin', country: 'Germany', category: 'Payments' },
  { name: 'Priority', city: 'Alpharetta', country: 'United States', category: 'Payments' },
  { name: 'Rapyd', city: 'London', country: 'United Kingdom', category: 'Payments' },
  { name: 'Razorpay', city: 'Bangalore', country: 'India', category: 'Payments' },
  { name: 'Remitly', city: 'Seattle', country: 'United States', category: 'Payments' },
  { name: 'Ripple', city: 'San Francisco', country: 'United States', category: 'Payments' },
  { name: 'Sezzle', city: 'Minneapolis', country: 'United States', category: 'Payments' },
  { name: 'Sipay', city: 'Istanbul', country: 'Turkey', category: 'Payments' },
  { name: 'Stone', city: 'Sao Paulo', country: 'Brazil', category: 'Payments' },
  { name: 'Stripe', city: 'San Francisco / Dublin', country: 'United States / Ireland', category: 'Payments' },
  { name: 'SumUp', city: 'London', country: 'United Kingdom', category: 'Payments' },
  { name: 'SUNRATE', city: 'Singapore', country: 'Singapore', category: 'Payments' },
  { name: 'Tazapay', city: 'Singapore', country: 'Singapore', category: 'Payments' },
  { name: 'Tencent', city: 'Shenzhen', country: 'China', category: 'Payments' },
  { name: 'TerraPay', city: 'London', country: 'United Kingdom', category: 'Payments' },
  { name: 'Thunes', city: 'Singapore', country: 'Singapore', category: 'Payments' },
  { name: 'Toast', city: 'Boston', country: 'United States', category: 'Payments' },
  { name: 'Toss', city: 'Seoul', country: 'South Korea', category: 'Payments' },
  { name: 'Trustly', city: 'Stockholm', country: 'Sweden', category: 'Payments' },
  { name: 'Tyro', city: 'Sydney', country: 'Australia', category: 'Payments' },
  { name: 'Visa', city: 'Foster City', country: 'United States', category: 'Payments' },
  { name: 'Wave Money', city: 'Yangon', country: 'Myanmar', category: 'Payments' },
  { name: 'Wise', city: 'London', country: 'United Kingdom', category: 'Payments' },
  { name: 'Ant International', city: 'Singapore', country: 'Singapore', category: 'Payments' },
  { name: 'Yoco', city: 'Cape Town', country: 'South Africa', category: 'Payments' },
  { name: 'YouTrip', city: 'Singapore', country: 'Singapore', category: 'Payments' },
  { name: 'Yuno', city: 'New York', country: 'United States', category: 'Payments' },
  { name: 'Zaver', city: 'Stockholm', country: 'Sweden', category: 'Payments' },
  { name: 'Zilch', city: 'London', country: 'United Kingdom', category: 'Payments' },

  // Alternative Finance
  { name: 'Akulaku', city: 'Jakarta', country: 'Indonesia', category: 'Alt Finance' },
  { name: 'Aye Finance', city: 'Gurugram', country: 'India', category: 'Alt Finance' },
  { name: 'Best Egg', city: 'Wilmington', country: 'United States', category: 'Alt Finance' },
  { name: 'Biz2Credit', city: 'New York', country: 'United States', category: 'Alt Finance' },
  { name: 'Bluevine', city: 'Redwood City', country: 'United States', category: 'Alt Finance' },
  { name: 'Bondora', city: 'Tallinn', country: 'Estonia', category: 'Alt Finance' },
  { name: 'C2FO', city: 'Leawood', country: 'United States', category: 'Alt Finance' },
  { name: 'CapBay', city: 'Petaling Jaya', country: 'Malaysia', category: 'Alt Finance' },
  { name: 'Collin Crowdfund', city: 'Oisterwijk', country: 'The Netherlands', category: 'Alt Finance' },
  { name: 'Companisto', city: 'Berlin', country: 'Germany', category: 'Alt Finance' },
  { name: 'Crowd Street', city: 'New York', country: 'United States', category: 'Alt Finance' },
  { name: 'Earnest', city: 'San Francisco', country: 'United States', category: 'Alt Finance' },
  { name: 'Enova', city: 'Chicago', country: 'United States', category: 'Alt Finance' },
  { name: 'Fundbox', city: 'San Francisco', country: 'United States', category: 'Alt Finance' },
  { name: 'Funding Circle', city: 'London', country: 'United Kingdom', category: 'Alt Finance' },
  { name: 'Funding Societies', city: 'Singapore', country: 'Singapore', category: 'Alt Finance' },
  { name: 'Happy Money', city: 'Torrance', country: 'United States', category: 'Alt Finance' },
  { name: 'InCred', city: 'Mumbai', country: 'India', category: 'Alt Finance' },
  { name: 'Iuvo group', city: 'Tallinn', country: 'Estonia', category: 'Alt Finance' },
  { name: 'Iwoca', city: 'London', country: 'United Kingdom', category: 'Alt Finance' },
  { name: 'Kueski', city: 'Guadalajara', country: 'Mexico', category: 'Alt Finance' },
  { name: 'Liberis', city: 'London', country: 'United Kingdom', category: 'Alt Finance' },
  { name: 'LoanDepot', city: 'Irvine', country: 'United States', category: 'Alt Finance' },
  { name: 'MicroVentures', city: 'Austin', country: 'United States', category: 'Alt Finance' },
  { name: 'M-KOPA', city: 'London', country: 'United Kingdom', category: 'Alt Finance' },
  { name: 'PeerBerry', city: 'Zagreb', country: 'Croatia', category: 'Alt Finance' },
  { name: 'Plenti', city: 'Sydney', country: 'Australia', category: 'Alt Finance' },
  { name: 'Prosper', city: 'San Francisco', country: 'United States', category: 'Alt Finance' },
  { name: 'Raize', city: 'Lisbon', country: 'Portugal', category: 'Alt Finance' },
  { name: 'SellersFi', city: 'Sunrise', country: 'United States', category: 'Alt Finance' },
  { name: 'Sun Finance', city: 'Riga', country: 'Latvia', category: 'Alt Finance' },
  { name: 'Tala', city: 'Santa Monica', country: 'United States', category: 'Alt Finance' },
  { name: 'Teylor', city: 'Zurich', country: 'Switzerland', category: 'Alt Finance' },
  { name: 'UnaFinancial', city: 'Singapore', country: 'Singapore', category: 'Alt Finance' },
  { name: 'Upstart', city: 'San Carlos', country: 'United States', category: 'Alt Finance' },
  { name: 'Urbanitae', city: 'Madrid', country: 'Spain', category: 'Alt Finance' },
  { name: 'Wayflyer', city: 'Dublin', country: 'Ireland', category: 'Alt Finance' },
  { name: 'WeLend', city: 'Hong Kong', country: 'SAR, China', category: 'Alt Finance' },
  { name: 'YouLend', city: 'London', country: 'United Kingdom', category: 'Alt Finance' },
  { name: 'Yubi', city: 'Chennai', country: 'India', category: 'Alt Finance' },
];

// Current TAM filter countries
const tamCountries = ['United States', 'United Kingdom', 'Canada', 'Brazil'];

function normalizeCountry(country: string): string {
  if (country.includes('/')) return country.split('/')[0].trim(); // Handle dual countries
  return country.trim();
}

function main() {
  const byCountry: Record<string, CompanyInfo[]> = {};
  const inTamGeo: CompanyInfo[] = [];
  const outsideTamGeo: CompanyInfo[] = [];

  for (const company of allCompanies) {
    const country = normalizeCountry(company.country);

    if (!byCountry[country]) byCountry[country] = [];
    byCountry[country].push(company);

    if (tamCountries.includes(country)) {
      inTamGeo.push(company);
    } else {
      outsideTamGeo.push(company);
    }
  }

  console.log('=== GEOGRAPHY ANALYSIS ===\n');
  console.log(`Total companies: ${allCompanies.length}`);
  console.log(`In TAM geography (US, UK, CA, BR): ${inTamGeo.length}`);
  console.log(`Outside TAM geography: ${outsideTamGeo.length}\n`);

  console.log('=== COMPANIES BY COUNTRY ===');
  const sorted = Object.entries(byCountry).sort((a, b) => b[1].length - a[1].length);
  for (const [country, companies] of sorted) {
    const inGeo = tamCountries.includes(country) ? '✅' : '❌';
    console.log(`${inGeo} ${country}: ${companies.length} companies`);
  }

  console.log('\n=== OUTSIDE TAM GEOGRAPHY (need filter expansion) ===');
  const outsideByCountry: Record<string, string[]> = {};
  for (const c of outsideTamGeo) {
    const country = normalizeCountry(c.country);
    if (!outsideByCountry[country]) outsideByCountry[country] = [];
    outsideByCountry[country].push(c.name);
  }

  for (const [country, names] of Object.entries(outsideByCountry).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${country} (${names.length}):`);
    console.log(`  ${names.join(', ')}`);
  }

  console.log('\n\n=== US COMPANIES (should be captured) ===');
  const usCompanies = inTamGeo.filter(c => normalizeCountry(c.country) === 'United States');
  console.log(`Total US companies: ${usCompanies.length}`);
  console.log('Companies:');
  for (const c of usCompanies) {
    console.log(`  - ${c.name} (${c.category})`);
  }
}

main();
