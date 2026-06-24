const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function addCostPriceLogsTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'multitenant_pos'
  });

  try {
    console.log('Creating cost_price_logs table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`cost_price_logs\` (
        \`id\` INT AUTO_INCREMENT,
        \`shop_id\` INT NOT NULL,
        \`supplier_id\` INT NULL,
        \`product_id\` INT NOT NULL,
        \`old_cost_price\` DECIMAL(10,2) NULL,
        \`new_cost_price\` DECIMAL(10,2) NOT NULL,
        \`reason\` VARCHAR(255) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_cost_price_logs_shop\` (\`shop_id\`),
        CONSTRAINT \`fk_cost_price_logs_shop\` FOREIGN KEY (\`shop_id\`) REFERENCES \`shops\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_cost_price_logs_supplier\` FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_cost_price_logs_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ cost_price_logs table created');
    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('Error creating table:', error.message);
  } finally {
    await connection.end();
  }
}

addCostPriceLogsTable();
