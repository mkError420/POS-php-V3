const db = require('./config/db');

async function run() {
  console.log('Starting migration to add due/payment columns...');
  try {
    // 1. Add due_balance to customers
    try {
      await db.query('ALTER TABLE customers ADD COLUMN due_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00;');
      console.log('  ✓ Added due_balance column to customers');
    } catch (e) {
      if (e.code === 'ER_DUP_COLUMN_NAME') {
        console.log('  ✓ due_balance already exists in customers');
      } else {
        throw e;
      }
    }

    // 2. Add paid_amount to sales
    try {
      await db.query('ALTER TABLE sales ADD COLUMN paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00;');
      console.log('  ✓ Added paid_amount column to sales');
    } catch (e) {
      if (e.code === 'ER_DUP_COLUMN_NAME') {
        console.log('  ✓ paid_amount already exists in sales');
      } else {
        throw e;
      }
    }

    // 3. Add due_amount to sales
    try {
      await db.query('ALTER TABLE sales ADD COLUMN due_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00;');
      console.log('  ✓ Added due_amount column to sales');
    } catch (e) {
      if (e.code === 'ER_DUP_COLUMN_NAME') {
        console.log('  ✓ due_amount already exists in sales');
      } else {
        throw e;
      }
    }

    // 4. Add due_amount to held_bills
    try {
      await db.query('ALTER TABLE held_bills ADD COLUMN due_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER items;');
      console.log('  ✓ Added due_amount column to held_bills');
    } catch (e) {
      if (e.code === 'ER_DUP_COLUMN_NAME') {
        console.log('  ✓ due_amount already exists in held_bills');
      } else {
        throw e;
      }
    }

    console.log('Migration complete successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

run();
