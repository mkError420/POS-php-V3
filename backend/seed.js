/**
 * seed.js — Demo Data Seeder for Multi-Tenant POS
 * Run once with: node seed.js
 *
 * Creates:
 *   Shop 1: Downtown Boutique  → admin: alice@boutique.com   / pw: alice123
 *   Shop 2: Tech Express       → admin: bob@techexpress.com  / pw: bob12345
 *   + 1 staff per shop
 */

const bcrypt = require('bcryptjs');
const db = require('./config/db');

const SALT_ROUNDS = 10;

async function hash(pw) {
  return bcrypt.hash(pw, SALT_ROUNDS);
}

async function seed() {
  console.log('\n🌱  Starting demo data seed...\n');

  try {
    // ── SHOP 1: Downtown Boutique ────────────────────────────────────────────
    const [shop1Check] = await db.query("SELECT id FROM shops WHERE email = 'contact@downtownboutique.com'");
    let shop1Id;

    if (shop1Check.length > 0) {
      shop1Id = shop1Check[0].id;
      console.log(`  ✓ Shop "Downtown Boutique" already exists (id=${shop1Id}), skipping.`);
    } else {
      const [shop1Result] = await db.query(
        `INSERT INTO shops (name, email, phone, address, status)
         VALUES ('Downtown Boutique', 'contact@downtownboutique.com', '555-1001', '12 Main Street, Dhaka', 'active')`
      );
      shop1Id = shop1Result.insertId;
      console.log(`  ✓ Created shop "Downtown Boutique" (id=${shop1Id})`);
    }

    // Admin for shop 1
    const [alice] = await db.query("SELECT id FROM users WHERE email = 'alice@boutique.com'");
    if (alice.length > 0) {
      console.log(`  ✓ User alice@boutique.com already exists, skipping.`);
    } else {
      await db.query(
        `INSERT INTO users (shop_id, name, email, password_hash, role, status)
         VALUES (?, 'Alice Rahman', 'alice@boutique.com', ?, 'shop_admin', 'active')`,
        [shop1Id, await hash('alice123')]
      );
      console.log(`  ✓ Created shop_admin: alice@boutique.com  /  alice123`);
    }

    // Staff for shop 1
    const [staff1] = await db.query("SELECT id FROM users WHERE email = 'staff1@boutique.com'");
    if (staff1.length > 0) {
      console.log(`  ✓ User staff1@boutique.com already exists, skipping.`);
    } else {
      await db.query(
        `INSERT INTO users (shop_id, name, email, password_hash, role, status)
         VALUES (?, 'Rahim Karim', 'staff1@boutique.com', ?, 'shop_staff', 'active')`,
        [shop1Id, await hash('staff123')]
      );
      console.log(`  ✓ Created shop_staff:  staff1@boutique.com /  staff123`);
    }

    // ── SHOP 2: Tech Express ─────────────────────────────────────────────────
    const [shop2Check] = await db.query("SELECT id FROM shops WHERE email = 'contact@techexpress.com'");
    let shop2Id;

    if (shop2Check.length > 0) {
      shop2Id = shop2Check[0].id;
      console.log(`  ✓ Shop "Tech Express" already exists (id=${shop2Id}), skipping.`);
    } else {
      const [shop2Result] = await db.query(
        `INSERT INTO shops (name, email, phone, address, status)
         VALUES ('Tech Express', 'contact@techexpress.com', '555-2002', '45 Tech Avenue, Chittagong', 'active')`
      );
      shop2Id = shop2Result.insertId;
      console.log(`  ✓ Created shop "Tech Express" (id=${shop2Id})`);
    }

    // Admin for shop 2
    const [bob] = await db.query("SELECT id FROM users WHERE email = 'bob@techexpress.com'");
    if (bob.length > 0) {
      console.log(`  ✓ User bob@techexpress.com already exists, skipping.`);
    } else {
      await db.query(
        `INSERT INTO users (shop_id, name, email, password_hash, role, status)
         VALUES (?, 'Bob Hossain', 'bob@techexpress.com', ?, 'shop_admin', 'active')`,
        [shop2Id, await hash('bob12345')]
      );
      console.log(`  ✓ Created shop_admin: bob@techexpress.com  /  bob12345`);
    }

    // Staff for shop 2
    const [staff2] = await db.query("SELECT id FROM users WHERE email = 'staff2@techexpress.com'");
    if (staff2.length > 0) {
      console.log(`  ✓ User staff2@techexpress.com already exists, skipping.`);
    } else {
      await db.query(
        `INSERT INTO users (shop_id, name, email, password_hash, role, status)
         VALUES (?, 'Nadia Islam', 'staff2@techexpress.com', ?, 'shop_staff', 'active')`,
        [shop2Id, await hash('staff123')]
      );
      console.log(`  ✓ Created shop_staff:  staff2@techexpress.com / staff123`);
    }

    console.log('\n✅  Seed complete! Demo credentials:\n');
    console.log('  Role         Email                       Password');
    console.log('  -----------  --------------------------  ----------');
    console.log('  super_admin  mk.rabbani.cse@gmail.com    123456789');
    console.log('  shop_admin   alice@boutique.com          alice123');
    console.log('  shop_staff   staff1@boutique.com         staff123');
    console.log('  shop_admin   bob@techexpress.com         bob12345');
    console.log('  shop_staff   staff2@techexpress.com      staff123');
    console.log('');

  } catch (err) {
    console.error('\n❌  Seed failed:', err.message);
  } finally {
    process.exit(0);
  }
}

seed();
