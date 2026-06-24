const db = require('./config/db');

async function run() {
  try {
    console.log('Adding supplier_id column and foreign key to products...');
    await db.query(`
      ALTER TABLE \`products\` 
      ADD COLUMN \`supplier_id\` INT DEFAULT NULL,
      ADD CONSTRAINT \`fk_products_supplier\` FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\`(\`id\`) ON DELETE SET NULL;
    `);
    console.log('Successfully altered table!');
    process.exit(0);
  } catch (error) {
    if (error.code === 'ER_DUP_COLUMN_NAME') {
      console.log('supplier_id column already exists.');
      process.exit(0);
    }
    console.error('Failed to add column:', error);
    process.exit(1);
  }
}

run();
