const express = require('express');
const db = require('../config/db');
const { authenticate, authorize, enforceTenant } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(enforceTenant);

/**
 * @route   GET /api/other-costs
 * @desc    Get all other costs for the active shop
 */
router.get('/', authorize(['super_admin', 'shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const hasShop = shopId !== null && shopId !== undefined;
  const { start_date, end_date } = req.query;

  try {
    let sql = `
      SELECT oc.*, s.name AS shop_name 
      FROM other_costs oc 
      LEFT JOIN shops s ON oc.shop_id = s.id 
      WHERE ` + (hasShop ? 'oc.shop_id = ?' : '1=1');
    const params = hasShop ? [shopId] : [];

    if (start_date) {
      sql += ' AND oc.cost_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND oc.cost_date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY oc.cost_date DESC, oc.created_at DESC';

    const [costs] = await db.query(sql, params);
    res.json(costs);
  } catch (error) {
    console.error('Fetch other costs error:', error);
    res.status(500).json({ error: 'Server error fetching cost records.' });
  }
});

/**
 * @route   POST /api/other-costs
 * @desc    Create a new other cost record
 */
router.post('/', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const { title, amount, cost_date, notes } = req.body;

  if (!title || amount === undefined || !cost_date) {
    return res.status(400).json({ error: 'Please provide title, amount, and cost date.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO other_costs (shop_id, title, amount, cost_date, notes) VALUES (?, ?, ?, ?, ?)',
      [shopId, title, parseFloat(amount), cost_date, notes || null]
    );
    res.status(201).json({ message: 'Other cost created successfully.', id: result.insertId });
  } catch (error) {
    console.error('Create other cost error:', error);
    res.status(500).json({ error: 'Server error creating cost record.' });
  }
});

/**
 * @route   PUT /api/other-costs/:id
 * @desc    Update an other cost record
 */
router.put('/:id', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const costId = req.params.id;
  const { title, amount, cost_date, notes } = req.body;

  try {
    // Verify record exists and belongs to active tenant
    const [existing] = await db.query(
      'SELECT id FROM other_costs WHERE id = ? AND shop_id = ?',
      [costId, shopId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Cost record not found or access denied.' });
    }

    const updateFields = [];
    const params = [];

    if (title !== undefined) { updateFields.push('title = ?'); params.push(title); }
    if (amount !== undefined) { updateFields.push('amount = ?'); params.push(parseFloat(amount)); }
    if (cost_date !== undefined) { updateFields.push('cost_date = ?'); params.push(cost_date); }
    if (notes !== undefined) { updateFields.push('notes = ?'); params.push(notes || null); }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No update parameters provided.' });
    }

    params.push(costId, shopId);

    await db.query(
      `UPDATE other_costs SET ${updateFields.join(', ')} WHERE id = ? AND shop_id = ?`,
      params
    );

    res.json({ message: 'Other cost record updated successfully.' });
  } catch (error) {
    console.error('Update other cost error:', error);
    res.status(500).json({ error: 'Server error updating cost record.' });
  }
});

/**
 * @route   DELETE /api/other-costs/:id
 * @desc    Delete an other cost record
 */
router.delete('/:id', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const costId = req.params.id;

  try {
    // Verify record exists and belongs to active tenant
    const [existing] = await db.query(
      'SELECT id FROM other_costs WHERE id = ? AND shop_id = ?',
      [costId, shopId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Cost record not found or access denied.' });
    }

    await db.query('DELETE FROM other_costs WHERE id = ? AND shop_id = ?', [costId, shopId]);
    res.json({ message: 'Other cost record deleted successfully.' });
  } catch (error) {
    console.error('Delete other cost error:', error);
    res.status(500).json({ error: 'Server error deleting cost record.' });
  }
});

module.exports = router;
