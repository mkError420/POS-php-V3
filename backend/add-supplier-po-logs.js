const db = require('./config/db');

async function migrate() {
  try {
    console.log('Starting migration for Supplier PO & Cost Price Logs...');

    // 1. purchase_orders table
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`purchase_orders\` (
        \`id\` INT AUTO_INCREMENT,
        \`shop_id\` INT NOT NULL,
        \`supplier_id\` INT NOT NULL,
        \`status\` ENUM('draft', 'ordered', 'received', 'cancelled') NOT NULL DEFAULT 'draft',
        \`total_amount\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        \`order_date\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`received_date\` TIMESTAMP NULL,
        \`notes\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_po_shop\` FOREIGN KEY (\`shop_id\`) REFERENCES \`shops\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_po_supplier\` FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Created purchase_orders table');

    // 2. purchase_order_items table
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`purchase_order_items\` (
        \`id\` INT AUTO_INCREMENT,
        \`shop_id\` INT NOT NULL,
        \`purchase_order_id\` INT NOT NULL,
        \`product_id\` INT NOT NULL,
        \`quantity_ordered\` INT NOT NULL,
        \`quantity_received\` INT NOT NULL DEFAULT 0,
        \`cost_price\` DECIMAL(10,2) NOT NULL,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_po_items_shop\` FOREIGN KEY (\`shop_id\`) REFERENCES \`shops\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_po_items_po\` FOREIGN KEY (\`purchase_order_id\`) REFERENCES \`purchase_orders\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_po_items_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Created purchase_order_items table');

    // 3. cost_price_logs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`cost_price_logs\` (
        \`id\` INT AUTO_INCREMENT,
        \`shop_id\` INT NOT NULL,
        \`product_id\` INT NOT NULL,
        \`supplier_id\` INT NULL,
        \`old_cost_price\` DECIMAL(10,2) NOT NULL,
        \`new_cost_price\` DECIMAL(10,2) NOT NULL,
        \`change_reason\` VARCHAR(255) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_cp_logs_shop\` FOREIGN KEY (\`shop_id\`) REFERENCES \`shops\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_cp_logs_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_cp_logs_supplier\` FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Created cost_price_logs table');

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
