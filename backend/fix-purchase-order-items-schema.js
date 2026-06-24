const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function fixPurchaseOrderItemsSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'multitenant_pos'
  });

  try {
    console.log('Checking current purchase_order_items table structure...');
    const [columns] = await connection.query("SHOW COLUMNS FROM `purchase_order_items`");
    const columnNames = columns.map(col => col.Field);
    console.log('Current columns:', columnNames);

    // Check if quantity_ordered column exists
    if (!columnNames.includes('quantity_ordered')) {
      console.log('Adding quantity_ordered column...');
      if (columnNames.includes('quantity')) {
        // Rename existing quantity to quantity_ordered
        await connection.query("ALTER TABLE `purchase_order_items` CHANGE COLUMN `quantity` `quantity_ordered` INT NOT NULL");
        console.log('✓ Renamed quantity to quantity_ordered');
      } else {
        // Add new column
        await connection.query("ALTER TABLE `purchase_order_items` ADD COLUMN `quantity_ordered` INT NOT NULL DEFAULT 0");
        console.log('✓ Added quantity_ordered column');
      }
    }

    // Check if quantity_received column exists
    if (!columnNames.includes('quantity_received')) {
      console.log('Adding quantity_received column...');
      await connection.query("ALTER TABLE `purchase_order_items` ADD COLUMN `quantity_received` INT NOT NULL DEFAULT 0");
      console.log('✓ Added quantity_received column');
    }

    // Check if cost_price column exists
    if (!columnNames.includes('cost_price')) {
      console.log('Adding cost_price column...');
      if (columnNames.includes('unit_price')) {
        // Rename existing unit_price to cost_price
        await connection.query("ALTER TABLE `purchase_order_items` CHANGE COLUMN `unit_price` `cost_price` DECIMAL(10,2) NOT NULL");
        console.log('✓ Renamed unit_price to cost_price');
      } else {
        // Add new column
        await connection.query("ALTER TABLE `purchase_order_items` ADD COLUMN `cost_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
        console.log('✓ Added cost_price column');
      }
    }

    // Check if selling_price column exists
    if (!columnNames.includes('selling_price')) {
      console.log('Adding selling_price column...');
      await connection.query("ALTER TABLE `purchase_order_items` ADD COLUMN `selling_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
      console.log('✓ Added selling_price column');
    }

    // Remove subtotal column if it exists (it's calculated, not stored)
    if (columnNames.includes('subtotal')) {
      console.log('Removing subtotal column (calculated field)...');
      await connection.query("ALTER TABLE `purchase_order_items` DROP COLUMN `subtotal`");
      console.log('✓ Removed subtotal column');
    }

    // Remove expiry_date column if it exists (not used in current implementation)
    if (columnNames.includes('expiry_date')) {
      console.log('Removing expiry_date column...');
      await connection.query("ALTER TABLE `purchase_order_items` DROP COLUMN `expiry_date`");
      console.log('✓ Removed expiry_date column');
    }

    console.log('\n✅ purchase_order_items table schema fixed successfully!');
    
    // Verify final structure
    const [finalColumns] = await connection.query("SHOW COLUMNS FROM `purchase_order_items`");
    console.log('\nFinal table structure:');
    finalColumns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });

  } catch (error) {
    console.error('Error fixing schema:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

fixPurchaseOrderItemsSchema();
