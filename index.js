const csv = require('csvtojson');
const Big = require('big.js');
const EU = require('./eu');

function safeNumber(str) {
  if (!str) {
    return Big(0);
  }
  return Big(str.replace(',', '.'));
}

async function main() {
  const filename = process.argv[2];
  if (!filename) {
    throw new Error('You must specify a filename argument');
  }

  const data = await csv().fromFile(filename);

  let totalVat = Big(0);
  let totalGross = Big(0);
  let totalFees = Big(0);
  let totalNet = Big(0);
  let totalPerCountry = {};

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
      console.log(id, created, country, gross.toString(), fee.toString(), net.toString());

      if (currency != 'sek') {
        throw new Error('Expected all transactions to be SEK...');
      }
      if (!country) {
        throw new Error('No country for transaction');
      }

      totalGross = totalGross.plus(gross);
      totalFees = totalFees.plus(fee);
      totalNet = totalNet.plus(net);
      if (EU.includes(country)) {
        totalVat = totalVat.plus(net.times(0.25));
      }
      if (!totalPerCountry[country]) {
        totalPerCountry[country] = Big(0);
      }
      totalPerCountry[country] = totalPerCountry[country].plus(net);
    }
  }

  console.log();
  console.log('Total Gross:'.padEnd(15), totalGross.toFixed(2).padStart(10));
  console.log('Total Fees:'.padEnd(15), totalFees.toFixed(2).padStart(10));
  console.log('Total Net:'.padEnd(15), totalNet.toFixed(2).padStart(10));
  console.log('Total VAT:'.padEnd(15), totalVat.toFixed(2).padStart(10));
  console.log();

  console.log('VAT (25%):')
  for (const key in totalPerCountry) {
    const vat = totalPerCountry[key].times(0.25).toFixed(2).padStart(10);
    console.log(key.padEnd(15), totalPerCountry[key].toFixed(2).padStart(10), EU.includes(key) ? ' -> ' + vat : '');
  }
  console.log();
}

main();
