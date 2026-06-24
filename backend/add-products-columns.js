const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function addProductsColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'multitenant_pos'
  });

  try {
    console.log('Adding expiry_date column to products table...');
    await connection.query(`
      ALTER TABLE \`products\` ADD COLUMN \`expiry_date\` DATE NULL
    `);
    console.log('✓ expiry_date column added');

    console.log('Adding supplier_id column to products table...');
    await connection.query(`
      ALTER TABLE \`products\` ADD COLUMN \`supplier_id\` INT NULL
    `);
    console.log('✓ supplier_id column added');

    console.log('Adding foreign key constraint for supplier_id...');
    await connection.query(`
      ALTER TABLE \`products\` 
      ADD CONSTRAINT \`fk_products_supplier\` 
      FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\` (\`id\`) 
      ON DELETE SET NULL 
      ON UPDATE CASCADE
    `);
    console.log('✓ Foreign key constraint added');

    console.log('\n✅ All products table columns added successfully!');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Column(s) already exist, skipping...');
    } else {
      console.error('Error adding columns:', error.message);
    }
  } finally {
    await connection.end();
  }
}

addProductsColumns();
