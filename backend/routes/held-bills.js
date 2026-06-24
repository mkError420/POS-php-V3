const express = require('express');
const db = require('../config/db');
const { authenticate, enforceTenant } = require('../middleware/auth');

const router = express.Router();

// Enforce auth & tenant isolation for all held bills endpoints
router.use(authenticate);
router.use(enforceTenant);

/**
 * @route   GET /api/held-bills
 * @desc    Get all held bills for the active shop
 * @access  Private (shop_admin, shop_staff)
 */
router.get('/', async (req, res) => {
  const shopId = req.shopId;

  try {
    const [heldBills] = await db.query(
      `SELECT hb.*, u.name as staff_name 
       FROM held_bills hb
       JOIN users u ON hb.user_id = u.id
       WHERE hb.shop_id = ?
       ORDER BY hb.created_at DESC`,
      [shopId]
    );

    // Fetch product details for all items in held bills to provide detailed UI info
    for (let bill of heldBills) {
      let itemsList = [];
      try {
        itemsList = typeof bill.items === 'string' ? JSON.parse(bill.items) : bill.items;
      } catch (e) {
        itemsList = [];
      }

      if (itemsList && itemsList.length > 0) {
        const productIds = itemsList.map(item => item.product_id);
        const [products] = await db.query(
          'SELECT id, name, sku, price FROM products WHERE id IN (?) AND shop_id = ?',
          [productIds, shopId]
        );
        
        const productMap = {};
        products.forEach(p => {
          productMap[p.id] = p;
        });

        bill.items = itemsList.map(item => {
          const prod = productMap[item.product_id] || {};
          return {
            ...item,
            name: prod.name || 'Unknown Product',
            sku: prod.sku || 'N/A',
            price: parseFloat(prod.price || 0)
          };
        });
      } else {
        bill.items = [];
      }
    }

    res.json(heldBills);
  } catch (error) {
    console.error('Fetch held bills error:', error);
    res.status(500).json({ error: 'Server error retrieving held bills.' });
  }
});

/**
 * @route   POST /api/held-bills
 * @desc    Hold a bill / suspended cart
 * @access  Private (shop_admin, shop_staff)
 */
router.post('/', async (req, res) => {
  const shopId = req.shopId;
  const userId = req.user.id;
  const {
    customer_id,
    customer_name,
    customer_phone,
    customer_address,
    discount_percent = 0,
    notes,
    items
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cannot hold an empty cart.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO held_bills 
       (shop_id, user_id, customer_id, customer_name, customer_phone, customer_address, discount_percent, notes, items) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shopId,
        userId,
        customer_id || null,
        customer_name || null,
        customer_phone || null,
        customer_address || null,
        parseFloat(discount_percent),
        notes || null,
        JSON.stringify(items)
      ]
    );

    res.status(201).json({
      message: 'Bill held successfully.',
      heldBillId: result.insertId
    });
  } catch (error) {
    console.error('Create held bill error:', error);
    res.status(500).json({ error: 'Server error saving held bill.' });
  }
});

/**
 * @route   PUT /api/held-bills/:id
 * @desc    Update a held bill (status, notes)
 * @access  Private (shop_admin, shop_staff)
 */
router.put('/:id', async (req, res) => {
  const heldBillId = req.params.id;
  const shopId = req.shopId;
  const { status, notes } = req.body;

  try {
    // 1. Verify existence and ownership
    const [existing] = await db.query(
      'SELECT id, status, customer_id, due_amount FROM held_bills WHERE id = ? AND shop_id = ?',
      [heldBillId, shopId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Held bill not found or access denied.' });
    }

    const bill = existing[0];
    const oldStatus = bill.status;
    const customerId = bill.customer_id;
    const dueAmount = parseFloat(bill.due_amount || 0);

    // Handle customer due_balance updates based on status transitions
    if (status !== undefined && status !== oldStatus && dueAmount > 0 && customerId) {
      if (oldStatus === 'held' && (status === 'completed' || status === 'cancelled')) {
        // Unpaid -> Paid/Written off: Decrement customer's due balance
        await db.query(
          'UPDATE customers SET due_balance = due_balance - ? WHERE id = ? AND shop_id = ?',
          [dueAmount, customerId, shopId]
        );
      } else if ((oldStatus === 'completed' || oldStatus === 'cancelled') && status === 'held') {
        // Paid/Written off -> Unpaid: Re-increment customer's due balance
        await db.query(
          'UPDATE customers SET due_balance = due_balance + ? WHERE id = ? AND shop_id = ?',
          [dueAmount, customerId, shopId]
        );
      }
    }

    // 2. Validate parameters
    const updateFields = [];
    const params = [];

    if (status !== undefined) {
      const validStatuses = ['held', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value. Must be held, completed, or cancelled.' });
      }
      updateFields.push('status = ?');
      params.push(status);
    }

    if (notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(notes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No update parameters provided.' });
    }

    params.push(heldBillId, shopId);

    // 3. Update in DB
    await db.query(
      `UPDATE held_bills SET ${updateFields.join(', ')} WHERE id = ? AND shop_id = ?`,
      params
    );

    res.json({ message: 'Held bill updated successfully.' });
  } catch (error) {
    console.error('Update held bill error:', error);
    res.status(500).json({ error: 'Server error updating held bill.' });
  }
});

/**
 * @route   POST /api/held-bills/:id/pay-due
 * @desc    Collect partial or full due payment on a held bill (atomic transaction)
 * @access  Private (shop_admin, shop_staff)
 */
router.post('/:id/pay-due', async (req, res) => {
  const heldBillId = req.params.id;
  const shopId = req.shopId;
  const userId = req.user.id;
  const { payment_amount, payment_method = 'cash' } = req.body;

  const parsedAmount = parseFloat(payment_amount);

  if (!parsedAmount || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be a positive number.' });
  }

  const validMethods = ['cash', 'card', 'mobile_pay', 'other'];
  if (!validMethods.includes(payment_method)) {
    return res.status(400).json({ error: 'Invalid payment method.' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Fetch and lock the held bill
    const [bills] = await connection.query(
      'SELECT * FROM held_bills WHERE id = ? AND shop_id = ? FOR UPDATE',
      [heldBillId, shopId]
    );

    if (bills.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Held bill not found or access denied.' });
    }

    const bill = bills[0];
    const currentDue = parseFloat(bill.due_amount || 0);

    if (currentDue <= 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'This held bill has no outstanding due amount.' });
    }

    if (!bill.customer_id) {
      await connection.rollback();
      return res.status(400).json({ error: 'No customer linked to this held bill. Cannot process due payment.' });
    }

    // Cap payment at the remaining due
    const actualPayment = Math.min(parsedAmount, currentDue);
    const newDue = parseFloat((currentDue - actualPayment).toFixed(2));

    // 2. Update held bill due_amount (and auto-complete if fully paid)
    const newStatus = newDue <= 0 ? 'completed' : bill.status;
    await connection.query(
      'UPDATE held_bills SET due_amount = ?, status = ? WHERE id = ? AND shop_id = ?',
      [newDue, newStatus, heldBillId, shopId]
    );

     // 3. Reduce customer due_balance
    await connection.query(
      'UPDATE customers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
      [actualPayment, bill.customer_id, shopId]
    );

    // 4. Update the original sale due_amount to reflect the payment
    let originalSaleId = null;
    if (bill.notes && bill.notes.startsWith('Due from Sale #')) {
      const match = bill.notes.match(/Due from Sale #(\d+)/);
      if (match) {
        originalSaleId = parseInt(match[1]);
      }
    }

    if (originalSaleId) {
      await connection.query(
        'UPDATE sales SET paid_amount = paid_amount + ?, due_amount = GREATEST(due_amount - ?, 0) WHERE id = ? AND shop_id = ?',
        [actualPayment, actualPayment, originalSaleId, shopId]
      );
    }

    // 5. Record the due payment event in the due_payments history table
    await connection.query(
      `INSERT INTO due_payments (shop_id, customer_id, sale_id, amount, payment_method)
       VALUES (?, ?, ?, ?, ?)`,
      [shopId, bill.customer_id, originalSaleId, actualPayment, payment_method]
    );

    // 6. Record a sales transaction for the due payment (final_amount = 0 to avoid double counting revenue, paid_amount = actualPayment to log cash inflow)
    // Only created as a fallback if the held bill has no original sale linked
    if (!originalSaleId) {
      await connection.query(
        `INSERT INTO sales (shop_id, customer_id, user_id, total_amount, discount, tax, final_amount, paid_amount, due_amount, payment_method)
         VALUES (?, ?, ?, 0, 0, 0, 0, ?, 0, ?)`,
        [shopId, bill.customer_id, userId, actualPayment, payment_method]
      );
    }

    await connection.commit();

    // 5. Fetch updated customer due_balance
    const [custRows] = await db.query(
      'SELECT due_balance FROM customers WHERE id = ? AND shop_id = ?',
      [bill.customer_id, shopId]
    );

    res.json({
      message: `Due payment of ৳${actualPayment.toFixed(2)} collected successfully.`,
      held_bill_id: parseInt(heldBillId),
      payment_collected: actualPayment,
      remaining_due: newDue,
      new_status: newStatus,
      customer_due_balance: custRows.length > 0 ? parseFloat(custRows[0].due_balance) : 0
    });

  } catch (error) {
    await connection.rollback();
    console.error('Due payment error:', error);
    res.status(500).json({ error: 'Server error processing due payment.' });
  } finally {
    connection.release();
  }
});

/**
 * @route   DELETE /api/held-bills/:id
 * @desc    Delete a held bill
 * @access  Private (shop_admin, shop_staff)
 */
router.delete('/:id', async (req, res) => {
  const heldBillId = req.params.id;
  const shopId = req.shopId;

  try {
    const [result] = await db.query(
      'DELETE FROM held_bills WHERE id = ? AND shop_id = ?',
      [heldBillId, shopId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Held bill not found or access denied.' });
    }

    res.json({ message: 'Held bill deleted successfully.' });
  } catch (error) {
    console.error('Delete held bill error:', error);
    res.status(500).json({ error: 'Server error deleting held bill.' });
  }
});

module.exports = router;
