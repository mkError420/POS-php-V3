const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCsvHeader, groupSalesRows } = require('../utils/csv-import');

test('normalizes CSV headers consistently', () => {
  assert.equal(normalizeCsvHeader('Customer Name'), 'customer_name');
  assert.equal(normalizeCsvHeader('  Phone Number  '), 'phone_number');
  assert.equal(normalizeCsvHeader('SKU'), 'sku');
});

test('groups sales rows by invoice number', () => {
  const rows = [
    { invoice_no: 'INV-100', customer_name: 'Alice', product_sku: 'SKU-1', quantity: '2', unit_price: '10' },
    { invoice_no: 'INV-100', customer_name: 'Alice', product_sku: 'SKU-2', quantity: '1', unit_price: '5' },
    { invoice_no: 'INV-101', customer_name: 'Bob', product_sku: 'SKU-3', quantity: '3', unit_price: '8' }
  ];

  const groups = groupSalesRows(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[0].customerName, 'Alice');
  assert.equal(groups[1].items[0].quantity, 3);
});
