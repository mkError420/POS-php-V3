const db = require('./config/db');

async function run() {
  try {
    await db.query(`
      ALTER TABLE \`held_bills\` 
      ADD COLUMN \`status\` ENUM('held', 'completed', 'cancelled') NOT NULL DEFAULT 'held' AFTER \`items\`;
    `);
    console.log('Successfully added status column to held_bills table!');
    process.exit(0);
  } catch (error) {
    if (error.code === 'ER_DUP_COLUMN_NAME') {
      console.log('status column already exists in held_bills.');
      process.exit(0);
    }
    console.error('Failed to add status column:', error);
    process.exit(1);
  }
}

run();
