const db = require('./config/db');

async function run() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS \`held_bills\` (
        \`id\` INT AUTO_INCREMENT,
        \`shop_id\` INT NOT NULL,
        \`user_id\` INT NOT NULL,
        \`customer_id\` INT NULL,
        \`customer_name\` VARCHAR(100) NULL,
        \`customer_phone\` VARCHAR(20) NULL,
        \`customer_address\` TEXT NULL,
        \`discount_percent\` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        \`notes\` VARCHAR(255) NULL,
        \`items\` JSON NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_held_bills_shop\` FOREIGN KEY (\`shop_id\`) REFERENCES \`shops\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_held_bills_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_held_bills_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await db.query(createTableQuery);
    console.log('Successfully created held_bills table!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to create held_bills table:', error);
    process.exit(1);
  }
}

run();
