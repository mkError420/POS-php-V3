const db = require('./config/db');

async function run() {
  try {
    await db.query('ALTER TABLE products ADD COLUMN expiry_date DATE DEFAULT NULL;');
    console.log('Successfully added expiry_date column to products table!');
    process.exit(0);
  } catch (error) {
    if (error.code === 'ER_DUP_COLUMN_NAME') {
      console.log('expiry_date column already exists.');
      process.exit(0);
    }
    console.error('Failed to add column:', error);
    process.exit(1);
  }
}

run();
