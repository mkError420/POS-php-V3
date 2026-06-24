const db = require('./config/db');

async function run() {
  try {
    await db.query('ALTER TABLE shops ADD COLUMN tax_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00;');
    console.log('Successfully added tax_rate column to shops table!');
    process.exit(0);
  } catch (error) {
    if (error.code === 'ER_DUP_COLUMN_NAME') {
      console.log('tax_rate column already exists.');
      process.exit(0);
    }
    console.error('Failed to add column:', error);
    process.exit(1);
  }
}

run();
