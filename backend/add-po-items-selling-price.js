const db = require('./config/db');

async function migrate() {
  try {
    console.log('Adding selling_price column to purchase_order_items...');
    await db.query(`
      ALTER TABLE \`purchase_order_items\` 
      ADD COLUMN \`selling_price\` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER \`cost_price\`;
    `);
    console.log('Added column successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
