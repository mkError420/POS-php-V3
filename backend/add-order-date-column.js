const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function addOrderDateColumn() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'multitenant_pos'
  });

  try {
    console.log('Adding order_date column to purchase_orders table...');
    await connection.query(`
      ALTER TABLE \`purchase_orders\` ADD COLUMN \`order_date\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
    `);
    console.log('✓ order_date column added');
    console.log('\n✅ Migration complete!');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Column already exists, skipping...');
    } else {
      console.error('Error adding column:', error.message);
    }
  } finally {
    await connection.end();
  }
}

addOrderDateColumn();
