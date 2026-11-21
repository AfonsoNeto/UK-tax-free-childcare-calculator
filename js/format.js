const gbpFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP'
});

// Amounts are stored as integer pence; format for display as £1,092.35.
export function formatGBP(pence) {
  return gbpFormatter.format(pence / 100);
}
