const db = require('./config/db');

async function run() {
  try {
    await db.query('ALTER TABLE customers ADD COLUMN address TEXT NULL;');
    console.log('Successfully added address column to customers table!');
    process.exit(0);
  } catch (error) {
    if (error.code === 'ER_DUP_COLUMN_NAME') {
      console.log('Address column already exists.');
      process.exit(0);
    }
    console.error('Failed to add column:', error);
    process.exit(1);
  }
}

run();
