const csv = require('csvtojson');
const Big = require('big.js');
const EU = require('./eu');
const table = require('text-table');

const CURRENCY = 'sek';

function safeNumber(str) {
  if (!str) {
    return Big(0);
  }
  return Big(str.replace(',', '.'));
}

function makeTotals() {
  return {
    charges: 0,
    refunds: 0,
    vat: Big(0),
    gross: Big(0),
    fees: Big(0),
    net: Big(0),
  };
}

async function main() {
  const action = process.argv[2]
  const filename = process.argv[3];
  if (!filename) {
    throw new Error('You must specify a filename argument');
  }

  console.log(filename);
  console.log();

  const data = await csv().fromFile(filename);

  const totals = makeTotals();
  const totalsPerCountry = {};

  const transactions = [];

  for (const row of data) {
    const id = row['balance_transaction_id'];
    const created = row['created_utc'];
    const country = row['card_country'];
    const currency = row['currency'];
    const gross = safeNumber(row['gross']);
    const fee = safeNumber(row['fee']);
    const net = safeNumber(row['net']);
    const category = row['reporting_category'];

    if (category == 'charge' || category == 'refund') {
      transactions.push([id, created, country, gross.toString(), fee.toString(), net.toString()]);

      if (currency != CURRENCY) {
        throw new Error(`Expected all transactions to be ${CURRENCY}...`);
      }
      if (!country) {
        throw new Error('No country for transaction');
      }

      if (!totalsPerCountry[country]) {
        totalsPerCountry[country] = makeTotals();
      }
    
      const countryTotals = totalsPerCountry[country];

      if (category == 'charge') {
        totals.charges++;
        countryTotals.charges++;
      }
      if (category == 'refund') {
        totals.refunds++;
        countryTotals.refunds++;
      }
      
      totals.gross = totals.gross.plus(gross);
      totals.fees = totals.fees.plus(fee);
      totals.net = totals.net.plus(net);

      countryTotals.gross = countryTotals.gross.plus(gross);
      countryTotals.fees = countryTotals.fees.plus(fee);
      countryTotals.net = countryTotals.net.plus(net);

      if (EU.includes(country)) {
        totals.vat = totals.vat.plus(net.times(0.25));
        countryTotals.vat = countryTotals.vat.plus(net.times(0.25));
      }
    }
  }

  if (action == 'list') {
    const txTable = table(transactions);
    console.log(txTable);
  }

  const rows = [];
  rows.push(['COUNTRY', 'CHARGES', 'REFUNDS', 'GROSS', 'FEES', 'NET', 'VAT (25%)']);
  for (const code in totalsPerCountry) {
    const countryTotals = totalsPerCountry[code];
    const isEuCountry = EU.includes(code);
    rows.push([
      code,
      countryTotals.charges,
      countryTotals.refunds,
      countryTotals.gross.toFixed(2),
      countryTotals.fees.toFixed(2),
      countryTotals.net.toFixed(2),
      isEuCountry ? countryTotals.vat.toFixed(2) : '',
    ]);
  }
  rows.push([
    'Total',
    totals.charges,
    totals.refunds,
    totals.gross.toFixed(2),
    totals.fees.toFixed(2),
    totals.net.toFixed(2),
    totals.vat.toFixed(2),
  ])

  const countryTable = table(rows, { align: ['l', 'r', 'r', 'r', 'r', 'r', 'r'] });
  console.log(`Transactions: ${transactions.length}`);
  console.log();
  console.log(countryTable);
  console.log();

  const momsTable = table([
    ['2610 (K) Utgående moms, 25%', totals.vat.toFixed(2)],
    ['3011 (K) Försäljning tjänster inom Sverige, 25% moms:', totals.vat.div(0.25).minus(totals.vat).toFixed(2)],
    ['3305 (D) Försäljning tjänster till land utanför EU:', totals.vat.div(0.25).toFixed(2)],
  ], { align: ['l', 'r'] });
  console.log(momsTable);
  console.log();

}

main();
