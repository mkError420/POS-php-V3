const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(authorize(['super_admin', 'shop_admin']));
 
/**
 * @route   GET /api/wastages
 * @desc    Get all wastage adjustments with date filtering
 * @access  Private (super_admin, shop_admin)
 */
router.get('/', async (req, res) => {
  const shopId = req.shopId;
  const hasShop = shopId !== null && shopId !== undefined;
  const { start_date, end_date } = req.query;
 
  try {
    let query = `
      SELECT w.*, p.name AS product_name, p.sku AS product_sku, p.cost_price AS product_cost_price, s.name AS shop_name
      FROM wastages w
      JOIN products p ON w.product_id = p.id
      JOIN shops s ON w.shop_id = s.id
      WHERE ` + (hasShop ? 'w.shop_id = ?' : '1=1');
    const params = hasShop ? [shopId] : [];
 
    if (start_date && end_date) {
      query += ' AND w.adjusted_at BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    query += ' ORDER BY w.adjusted_at DESC, w.created_at DESC';
 
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fetch wastages error:', error);
    res.status(500).json({ error: 'Server error retrieving wastage ledger.' });
  }
});

/**
 * @route   POST /api/wastages
 * @desc    Record new stock wastage / damage adjustment
 * @access  Private (shop_admin)
 */
router.post('/', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const { product_id, quantity, reason, notes, adjusted_at } = req.body;
 
  if (!product_id || !quantity || !reason || !adjusted_at) {
    return res.status(400).json({ error: 'Product, quantity, reason, and adjustment date are required.' });
  }
 
  const adjustQty = parseInt(quantity);
  if (isNaN(adjustQty) || adjustQty <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive integer.' });
  }
 
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
 
    // 1. Fetch product information
    const [prods] = await conn.query(
      'SELECT cost_price, stock_quantity FROM products WHERE id = ? AND shop_id = ?',
      [product_id, shopId]
    );
 
    if (prods.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Product not found in inventory.' });
    }
 
    const product = prods[0];
    const cost_loss = parseFloat(product.cost_price) * adjustQty;
 
    // 2. Adjust inventory count (deduct from stock)
    await conn.query(
      'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND shop_id = ?',
      [adjustQty, product_id, shopId]
    );
 
    // 3. Log wastage entry
    const [result] = await conn.query(
      `INSERT INTO wastages (shop_id, product_id, quantity, cost_loss, reason, notes, adjusted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [shopId, product_id, adjustQty, cost_loss, reason, notes || null, adjusted_at]
    );
 
    await conn.commit();
    res.status(201).json({ id: result.insertId, message: 'Wastage stock adjustment logged successfully.' });
  } catch (error) {
    await conn.rollback();
    console.error('Log wastage error:', error);
    res.status(500).json({ error: 'Server error logging wastage entry.' });
  } finally {
    conn.release();
  }
});
 
/**
 * @route   DELETE /api/wastages/:id
 * @desc    Delete a wastage adjustment and restore product inventory
 * @access  Private (shop_admin)
 */
router.delete('/:id', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const wastageId = req.params.id;
 
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
 
    // 1. Fetch existing wastage entry
    const [existing] = await conn.query(
      'SELECT product_id, quantity FROM wastages WHERE id = ? AND shop_id = ?',
      [wastageId, shopId]
    );
 
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Wastage adjustment record not found.' });
    }
 
    const record = existing[0];
 
    // 2. Revert inventory count (add back stock)
    await conn.query(
      'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND shop_id = ?',
      [record.quantity, record.product_id, shopId]
    );
 
    // 3. Delete the wastage record
    await conn.query(
      'DELETE FROM wastages WHERE id = ? AND shop_id = ?',
      [wastageId, shopId]
    );
 
    await conn.commit();
    res.json({ message: 'Wastage adjustment deleted and inventory reverted successfully.' });
  } catch (error) {
    await conn.rollback();
    console.error('Delete wastage error:', error);
    res.status(500).json({ error: 'Server error deleting wastage adjustment.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
