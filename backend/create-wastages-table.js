const db = require('./config/db');

async function migrate() {
  try {
    console.log('Creating wastages table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`wastages\` (
        \`id\` INT AUTO_INCREMENT,
        \`shop_id\` INT NOT NULL,
        \`product_id\` INT NOT NULL,
        \`quantity\` INT NOT NULL,
        \`cost_loss\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        \`reason\` VARCHAR(255) NOT NULL,
        \`notes\` TEXT NULL,
        \`adjusted_at\` DATE NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_wastages_shop\` FOREIGN KEY (\`shop_id\`) REFERENCES \`shops\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_wastages_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Successfully created wastages table!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
