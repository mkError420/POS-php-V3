const express = require('express');
const db = require('../config/db');
const { authenticate, authorize, enforceTenant } = require('../middleware/auth');

const router = express.Router();

// Apply auth to all product routes
router.use(authenticate);
router.use(enforceTenant);

/**
 * @route   GET /api/products
 * @desc    Get all products for the active tenant. Supports search and low-stock filter.
 * @access  Private (shop_admin, shop_staff, or super_admin with shop_id)
 */
router.get('/', async (req, res) => {
  const { search, low_stock, expiring } = req.query;
  const shopId = req.shopId;
  const hasShop = shopId !== null && shopId !== undefined;

  try {
    let sql = `
      SELECT p.*, s.name AS supplier_name, sh.name AS shop_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN shops sh ON p.shop_id = sh.id
      WHERE ` + (hasShop ? 'p.shop_id = ?' : '1=1');
    const params = hasShop ? [shopId] : [];

    if (search) {
      sql += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (low_stock === 'true') {
      sql += ' AND p.stock_quantity <= p.low_stock_threshold';
    }

    if (expiring === 'true') {
      sql += ' AND p.expiry_date IS NOT NULL AND p.expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)';
    }

    sql += ' ORDER BY p.name ASC';

    const [products] = await db.query(sql, params);
    res.json(products);
  } catch (error) {
    console.error('Fetch products error:', error);
    res.status(500).json({ error: 'Server error retrieving products.' });
  }
});

/**
 * @route   GET /api/products/:id
 * @desc    Get a single product by ID (tenant isolated)
 */
router.get('/:id', async (req, res) => {
  const productId = req.params.id;
  const shopId = req.shopId;
  const hasShop = shopId !== null && shopId !== undefined;

  try {
    let sql = `
      SELECT p.*, s.name AS supplier_name 
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `;
    const params = [productId];

    if (hasShop) {
      sql += ' AND p.shop_id = ?';
      params.push(shopId);
    }

    const [products] = await db.query(sql, params);

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found or access denied.' });
    }

    res.json(products[0]);
  } catch (error) {
    console.error('Fetch product by ID error:', error);
    res.status(500).json({ error: 'Server error retrieving product.' });
  }
});

/**
 * @route   POST /api/products
 * @desc    Create a new product for the active tenant
 * @access  Private (shop_admin)
 */
router.post('/', authorize(['shop_admin']), async (req, res) => {
  const { name, sku, price, cost_price, stock_quantity, low_stock_threshold, expiry_date, supplier_id, unit } = req.body;
  const shopId = req.shopId;

  if (!name || !sku || price === undefined || cost_price === undefined) {
    return res.status(400).json({ error: 'Please provide name, sku, price, and cost price.' });
  }

  try {
    // Check SKU duplicate within this shop
    const [existing] = await db.query(
      'SELECT id FROM products WHERE shop_id = ? AND sku = ?',
      [shopId, sku]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'SKU already exists for this shop.' });
    }

    const [result] = await db.query(
      'INSERT INTO products (shop_id, name, sku, price, cost_price, stock_quantity, low_stock_threshold, expiry_date, supplier_id, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        shopId,
        name,
        sku,
        price,
        cost_price,
        stock_quantity || 0,
        low_stock_threshold !== undefined ? low_stock_threshold : 10,
        expiry_date || null,
        supplier_id || null,
        unit || 'piece'
      ]
    );

    res.status(201).json({
      message: 'Product created successfully.',
      productId: result.insertId
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Server error creating product.' });
  }
});

/**
 * @route   PUT /api/products/:id
 * @desc    Update a product (tenant isolated)
 * @access  Private (shop_admin)
 */
router.put('/:id', authorize(['shop_admin']), async (req, res) => {
  const productId = req.params.id;
  const shopId = req.shopId;
  const { name, sku, price, cost_price, stock_quantity, low_stock_threshold, expiry_date, supplier_id, unit } = req.body;

  try {
    // 1. Verify product belongs to active tenant
    const [products] = await db.query(
      'SELECT id FROM products WHERE id = ? AND shop_id = ?',
      [productId, shopId]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found or access denied.' });
    }

    // 2. Verify SKU uniqueness if changing SKU
    if (sku) {
      const [existing] = await db.query(
        'SELECT id FROM products WHERE shop_id = ? AND sku = ? AND id != ?',
        [shopId, sku, productId]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Another product with this SKU already exists.' });
      }
    }

    // 3. Perform update
    const updateFields = [];
    const params = [];

    if (name !== undefined) { updateFields.push('name = ?'); params.push(name); }
    if (sku !== undefined) { updateFields.push('sku = ?'); params.push(sku); }
    if (price !== undefined) { updateFields.push('price = ?'); params.push(price); }
    if (cost_price !== undefined) { updateFields.push('cost_price = ?'); params.push(cost_price); }
    if (stock_quantity !== undefined) { updateFields.push('stock_quantity = ?'); params.push(stock_quantity); }
    if (low_stock_threshold !== undefined) { updateFields.push('low_stock_threshold = ?'); params.push(low_stock_threshold); }
    if (expiry_date !== undefined) { updateFields.push('expiry_date = ?'); params.push(expiry_date || null); }
    if (supplier_id !== undefined) { updateFields.push('supplier_id = ?'); params.push(supplier_id || null); }
    if (unit !== undefined) { updateFields.push('unit = ?'); params.push(unit); }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No update parameters provided.' });
    }

    params.push(productId, shopId);

    await db.query(
      `UPDATE products SET ${updateFields.join(', ')} WHERE id = ? AND shop_id = ?`,
      params
    );

    res.json({ message: 'Product updated successfully.' });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Server error updating product.' });
  }
});

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete a product (tenant isolated)
 * @access  Private (shop_admin)
 */
router.delete('/:id', authorize(['shop_admin']), async (req, res) => {
  const productId = req.params.id;
  const shopId = req.shopId;

  try {
    // Verify product belongs to active tenant
    const [products] = await db.query(
      'SELECT id FROM products WHERE id = ? AND shop_id = ?',
      [productId, shopId]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found or access denied.' });
    }

    // Delete the product
    await db.query('DELETE FROM products WHERE id = ? AND shop_id = ?', [productId, shopId]);

    res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    console.error('Delete product error:', error);
    // If it's a foreign key violation (linked to existing transactions)
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ error: 'Cannot delete product. It is referenced in sales transaction records.' });
    }
    res.status(500).json({ error: 'Server error deleting product.' });
  }
});

module.exports = router;
