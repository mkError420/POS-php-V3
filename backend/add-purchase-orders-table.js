const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function addPurchaseOrdersTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'multitenant_pos'
  });

  try {
    console.log('Creating purchase_orders table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`purchase_orders\` (
        \`id\` INT AUTO_INCREMENT,
        \`shop_id\` INT NOT NULL,
        \`supplier_id\` INT NOT NULL,
        \`status\` ENUM('draft', 'ordered', 'received', 'cancelled') NOT NULL DEFAULT 'draft',
        \`total_amount\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        \`notes\` TEXT NULL,
        \`payment_basis\` ENUM('cash', 'credit') NOT NULL DEFAULT 'cash',
        \`paid_amount\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        \`due_amount\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        \`received_date\` TIMESTAMP NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_purchase_orders_shop\` (\`shop_id\`),
        INDEX \`idx_purchase_orders_supplier\` (\`supplier_id\`),
        CONSTRAINT \`fk_purchase_orders_shop\`
          FOREIGN KEY (\`shop_id\`)
          REFERENCES \`shops\` (\`id\`)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
        CONSTRAINT \`fk_purchase_orders_supplier\`
          FOREIGN KEY (\`supplier_id\`)
          REFERENCES \`suppliers\` (\`id\`)
          ON DELETE RESTRICT
          ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ purchase_orders table created');

    console.log('Creating purchase_order_items table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`purchase_order_items\` (
        \`id\` INT AUTO_INCREMENT,
        \`purchase_order_id\` INT NOT NULL,
        \`shop_id\` INT NOT NULL,
        \`product_id\` INT NOT NULL,
        \`quantity\` INT NOT NULL,
        \`unit_price\` DECIMAL(10,2) NOT NULL,
        \`selling_price\` DECIMAL(10,2) NULL,
        \`subtotal\` DECIMAL(10,2) NOT NULL,
        \`expiry_date\` DATE NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_po_items_order\` (\`purchase_order_id\`),
        CONSTRAINT \`fk_po_items_order\`
          FOREIGN KEY (\`purchase_order_id\`)
          REFERENCES \`purchase_orders\` (\`id\`)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
        CONSTRAINT \`fk_po_items_shop\`
          FOREIGN KEY (\`shop_id\`)
          REFERENCES \`shops\` (\`id\`)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
        CONSTRAINT \`fk_po_items_product\`
          FOREIGN KEY (\`product_id\`)
          REFERENCES \`products\` (\`id\`)
          ON DELETE RESTRICT
          ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ purchase_order_items table created');

    console.log('\n✅ All purchase order tables created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error.message);
  } finally {
    await connection.end();
  }
}

addPurchaseOrdersTables();
