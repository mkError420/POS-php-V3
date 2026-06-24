const express = require('express');
const db = require('../config/db');
const { authenticate, authorize, enforceTenant } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(enforceTenant);

/**
 * @route   GET /api/manual-orders
 * @desc    Fetch all manual sales orders for the active tenant
 * @access  Private (shop_admin, shop_staff)
 */
router.get('/', async (req, res) => {
  const shopId = req.shopId;
  try {
    const [orders] = await db.query(
      `SELECT mo.*, u.name as created_by_name, 
              COALESCE(c.name, mo.customer_name) as customer_name,
              COALESCE(c.phone, mo.customer_phone) as customer_phone,
              s.due_amount as current_sale_due,
              s.final_amount as sale_final_amount,
              s.paid_amount as sale_paid_amount
       FROM manual_orders mo
       LEFT JOIN users u ON mo.created_by = u.id
       LEFT JOIN customers c ON mo.customer_id = c.id
       LEFT JOIN sales s ON mo.sale_id = s.id
       WHERE mo.shop_id = ?
       ORDER BY mo.created_at DESC`,
      [shopId]
    );
    res.json(orders);
  } catch (error) {
    console.error('Fetch manual orders error:', error);
    res.status(500).json({ error: 'Server error retrieving manual orders.' });
  }
});

/**
 * @route   GET /api/manual-orders/:id
 * @desc    Fetch details of a specific manual order (with items)
 * @access  Private (shop_admin, shop_staff)
 */
router.get('/:id', async (req, res) => {
  const orderId = req.params.id;
  const shopId = req.shopId;
  try {
    const [orders] = await db.query(
      `SELECT mo.*, u.name as created_by_name,
              COALESCE(c.name, mo.customer_name) as customer_name,
              COALESCE(c.phone, mo.customer_phone) as customer_phone,
              COALESCE(c.address, mo.customer_address) as customer_address,
              s.due_amount as current_sale_due,
              s.final_amount as sale_final_amount,
              s.paid_amount as sale_paid_amount
       FROM manual_orders mo
       LEFT JOIN users u ON mo.created_by = u.id
       LEFT JOIN customers c ON mo.customer_id = c.id
       LEFT JOIN sales s ON mo.sale_id = s.id
       WHERE mo.id = ? AND mo.shop_id = ?`,
      [orderId, shopId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Manual order not found.' });
    }

    const [items] = await db.query(
      `SELECT moi.*, p.name as product_name, p.sku as product_sku, p.unit
       FROM manual_order_items moi
       JOIN products p ON moi.product_id = p.id
       WHERE moi.order_id = ? AND moi.shop_id = ?`,
      [orderId, shopId]
    );

    res.json({
      ...orders[0],
      items
    });
  } catch (error) {
    console.error('Fetch manual order details error:', error);
    res.status(500).json({ error: 'Server error retrieving manual order details.' });
  }
});

/**
 * @route   POST /api/manual-orders
 * @desc    Create a new manual order (draft / pending status)
 * @access  Private (shop_admin, shop_staff)
 */
router.post('/', authorize(['shop_admin', 'shop_staff']), async (req, res) => {
  const shopId = req.shopId;
  const userId = req.user.id;
  const { salesman_name, customer_name, customer_phone, customer_address, payment_method, discount = 0, tax = 0, notes, items = [] } = req.body;

  if (!salesman_name) {
    return res.status(400).json({ error: 'Salesman name is required.' });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order items are required.' });
  }
  if (payment_method === 'credit' && !customer_name) {
    return res.status(400).json({ error: 'Customer Name is required for credit sales.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Insert order header
    const [orderResult] = await connection.query(
      `INSERT INTO manual_orders (shop_id, salesman_name, customer_name, customer_phone, customer_address, payment_method, discount, tax, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [shopId, salesman_name, customer_name || null, customer_phone || null, customer_address || null, payment_method || 'cash', discount, tax, notes || null, userId]
    );
    const orderId = orderResult.insertId;

    // Insert items
    for (const item of items) {
      const { product_id, quantity, unit_price } = item;
      if (!product_id || !quantity || quantity <= 0 || unit_price === undefined) {
        throw new Error('Invalid item parameters.');
      }
      const subtotal = parseFloat(unit_price) * parseInt(quantity);
      await connection.query(
        `INSERT INTO manual_order_items (order_id, shop_id, product_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, shopId, product_id, quantity, unit_price, subtotal]
      );
    }

    await connection.commit();
    res.status(201).json({ message: 'Manual sales order recorded successfully.', order_id: orderId });
  } catch (error) {
    await connection.rollback();
    console.error('Create manual order failed:', error);
    res.status(400).json({ error: error.message || 'Failed to create manual order.' });
  } finally {
    connection.release();
  }
});

/**
 * @route   PUT /api/manual-orders/:id
 * @desc    Edit a pending manual order
 * @access  Private (shop_admin, shop_staff)
 */
router.put('/:id', authorize(['shop_admin', 'shop_staff']), async (req, res) => {
  const orderId = req.params.id;
  const shopId = req.shopId;
  const { salesman_name, customer_name, customer_phone, customer_address, payment_method, discount = 0, tax = 0, notes, items = [] } = req.body;

  if (!salesman_name) {
    return res.status(400).json({ error: 'Salesman name is required.' });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order items are required.' });
  }
  if (payment_method === 'credit' && !customer_name) {
    return res.status(400).json({ error: 'Customer Name is required for credit sales.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check status
    const [orderRows] = await connection.query(
      'SELECT status FROM manual_orders WHERE id = ? AND shop_id = ? FOR UPDATE',
      [orderId, shopId]
    );
    if (orderRows.length === 0) {
      throw new Error('Manual order not found.');
    }
    if (orderRows[0].status !== 'pending') {
      throw new Error('Only pending orders can be updated.');
    }

    // Update header
    await connection.query(
      `UPDATE manual_orders 
       SET salesman_name = ?, customer_name = ?, customer_phone = ?, customer_address = ?, payment_method = ?, discount = ?, tax = ?, notes = ?
       WHERE id = ? AND shop_id = ?`,
      [salesman_name, customer_name || null, customer_phone || null, customer_address || null, payment_method || 'cash', discount, tax, notes || null, orderId, shopId]
    );

    // Delete items
    await connection.query('DELETE FROM manual_order_items WHERE order_id = ? AND shop_id = ?', [orderId, shopId]);

    // Insert new items
    for (const item of items) {
      const { product_id, quantity, unit_price } = item;
      const subtotal = parseFloat(unit_price) * parseInt(quantity);
      await connection.query(
        `INSERT INTO manual_order_items (order_id, shop_id, product_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, shopId, product_id, quantity, unit_price, subtotal]
      );
    }

    await connection.commit();
    res.json({ message: 'Manual sales order updated successfully.' });
  } catch (error) {
    await connection.rollback();
    console.error('Update manual order failed:', error);
    res.status(400).json({ error: error.message || 'Failed to update manual order.' });
  } finally {
    connection.release();
  }
});

/**
 * @route   DELETE /api/manual-orders/:id
 * @desc    Delete/cancel a pending manual order
 * @access  Private (shop_admin, shop_staff)
 */
router.delete('/:id', authorize(['shop_admin', 'shop_staff']), async (req, res) => {
  const orderId = req.params.id;
  const shopId = req.shopId;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.query(
      'SELECT status FROM manual_orders WHERE id = ? AND shop_id = ? FOR UPDATE',
      [orderId, shopId]
    );
    if (orderRows.length === 0) {
      throw new Error('Manual order not found.');
    }
    if (orderRows[0].status !== 'pending') {
      throw new Error('Only pending orders can be deleted.');
    }

    await connection.query('DELETE FROM manual_order_items WHERE order_id = ? AND shop_id = ?', [orderId, shopId]);
    await connection.query('DELETE FROM manual_orders WHERE id = ? AND shop_id = ?', [orderId, shopId]);

    await connection.commit();
    res.json({ message: 'Manual sales order deleted successfully.' });
  } catch (error) {
    await connection.rollback();
    console.error('Delete manual order failed:', error);
    res.status(400).json({ error: error.message || 'Failed to delete manual order.' });
  } finally {
    connection.release();
  }
});

/**
 * @route   POST /api/manual-orders/:id/confirm
 * @desc    Confirm a pending manual order and convert it to a normal invoice/POS sale
 * @access  Private (shop_admin, shop_staff)
 */
router.post('/:id/confirm', authorize(['shop_admin', 'shop_staff']), async (req, res) => {
  const orderId = req.params.id;
  const shopId = req.shopId;
  const userId = req.user.id;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch manual order and lock it
    const [orderRows] = await connection.query(
      'SELECT * FROM manual_orders WHERE id = ? AND shop_id = ? FOR UPDATE',
      [orderId, shopId]
    );
    if (orderRows.length === 0) {
      throw new Error('Manual order not found.');
    }
    const order = orderRows[0];

    if (order.status !== 'pending') {
      throw new Error('This manual order has already been confirmed or processed.');
    }

    // 2. Fetch items for this manual order
    const [orderItems] = await connection.query(
      'SELECT product_id, quantity, unit_price, subtotal FROM manual_order_items WHERE order_id = ? AND shop_id = ?',
      [orderId, shopId]
    );

    if (orderItems.length === 0) {
      throw new Error('This manual order has no items to process.');
    }

    // 3. Resolve Customer ID
    let resolvedCustomerId = order.customer_id;

    // If the customer profile details are manually provided, resolve or create it
    if (order.customer_name) {
      let customerRow = [];
      if (order.customer_phone) {
        [customerRow] = await connection.query(
          'SELECT id FROM customers WHERE shop_id = ? AND phone = ? LIMIT 1',
          [shopId, order.customer_phone]
        );
      } else {
        [customerRow] = await connection.query(
          'SELECT id FROM customers WHERE shop_id = ? AND name = ? LIMIT 1',
          [shopId, order.customer_name]
        );
      }

      if (customerRow.length > 0) {
        resolvedCustomerId = customerRow[0].id;
      } else {
        // Create new customer directory profile automatically
        const [insertResult] = await connection.query(
          'INSERT INTO customers (shop_id, name, phone, address, due_balance) VALUES (?, ?, ?, ?, 0.00)',
          [shopId, order.customer_name, order.customer_phone || null, order.customer_address || null]
        );
        resolvedCustomerId = insertResult.insertId;
      }
    }

    let calculatedTotal = 0;
    const validatedItems = [];

    // 4. Lock products and check stock
    for (const item of orderItems) {
      const { product_id, quantity, unit_price } = item;

      // Lock product row to prevent race conditions
      const [productRows] = await connection.query(
        'SELECT id, name, price, stock_quantity, low_stock_threshold FROM products WHERE id = ? AND shop_id = ? FOR UPDATE',
        [product_id, shopId]
      );

      if (productRows.length === 0) {
        throw new Error(`Product with ID ${product_id} not found in this shop.`);
      }

      const product = productRows[0];

      if (product.stock_quantity < quantity) {
        throw new Error(`Insufficient stock for product "${product.name}". Available: ${product.stock_quantity}, requested: ${quantity}.`);
      }

      calculatedTotal += parseFloat(unit_price) * quantity;

      validatedItems.push({
        product_id,
        quantity,
        unit_price: parseFloat(unit_price),
        subtotal: parseFloat(unit_price) * quantity
      });

      // Deduct stock quantity
      const newStock = product.stock_quantity - quantity;
      await connection.query(
        'UPDATE products SET stock_quantity = ? WHERE id = ? AND shop_id = ?',
        [newStock, product_id, shopId]
      );
    }

    // 5. Compute financial amounts
    const finalAmount = (calculatedTotal - parseFloat(order.discount)) + parseFloat(order.tax);
    
    let paidAmount = 0;
    let dueAmount = 0;
    let paymentMethodForSale = 'cash';

    if (order.payment_method === 'cash') {
      paidAmount = finalAmount;
      dueAmount = 0;
      paymentMethodForSale = 'cash';
    } else {
      // Credit Sale
      paidAmount = 0;
      dueAmount = finalAmount;
      paymentMethodForSale = 'other'; // maps to ENUM in sales table
    }

    if (dueAmount > 0 && !resolvedCustomerId) {
      throw new Error('Customer profile name or details are required to process outstanding credit sales.');
    }

    // 6. Save sale transaction
    const [salesResult] = await connection.query(
      `INSERT INTO sales (shop_id, customer_id, user_id, total_amount, discount, tax, final_amount, paid_amount, due_amount, payment_method) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [shopId, resolvedCustomerId || null, userId, calculatedTotal, order.discount, order.tax, finalAmount, paidAmount, dueAmount, paymentMethodForSale]
    );

    const saleId = salesResult.insertId;

    // 7. Save line items in sale_items table
    for (const item of validatedItems) {
      await connection.query(
        `INSERT INTO sale_items (shop_id, sale_id, product_id, quantity, unit_price, subtotal) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [shopId, saleId, item.product_id, item.quantity, item.unit_price, item.subtotal]
      );
    }

    // 8. Update customer record ONLY (DO NOT insert into held_bills table)
    if (dueAmount > 0 && resolvedCustomerId) {
      // Increment customer due_balance
      await connection.query(
        'UPDATE customers SET due_balance = due_balance + ? WHERE id = ? AND shop_id = ?',
        [dueAmount, resolvedCustomerId, shopId]
      );
    }

    // 9. Update manual order status and write back resolved customer ID
    await connection.query(
      'UPDATE manual_orders SET status = "confirmed", sale_id = ?, customer_id = ? WHERE id = ? AND shop_id = ?',
      [saleId, resolvedCustomerId, orderId, shopId]
    );

    await connection.commit();

    res.json({
      message: 'Manual order confirmed and invoice generated successfully.',
      sale_id: saleId,
      final_amount: finalAmount
    });

  } catch (error) {
    await connection.rollback();
    console.error('Confirm manual order failed:', error);
    res.status(400).json({ error: error.message || 'Failed to confirm manual order.' });
  } finally {
    connection.release();
  }
});

/**
 * @route   POST /api/manual-orders/sales/:saleId/pay-due
 * @desc    Collect payment for a manual credit sales order's outstanding balance
 * @access  Private (shop_admin, shop_staff)
 */
router.post('/sales/:saleId/pay-due', authorize(['shop_admin', 'shop_staff']), async (req, res) => {
  const saleId = req.params.saleId;
  const shopId = req.shopId;
  const { payment_amount, payment_method = 'cash', transaction_reference, note } = req.body;

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

    // 1. Fetch and lock original sale
    const [sales] = await connection.query(
      'SELECT * FROM sales WHERE id = ? AND shop_id = ? FOR UPDATE',
      [saleId, shopId]
    );

    if (sales.length === 0) {
      throw new Error('Sale record not found.');
    }

    const sale = sales[0];
    const currentDue = parseFloat(sale.due_amount || 0);

    if (currentDue <= 0) {
      throw new Error('This sale has no outstanding due amount.');
    }

    const actualPayment = Math.min(parsedAmount, currentDue);
    const newDue = parseFloat((currentDue - actualPayment).toFixed(2));

    // 2. Update sale paid_amount and due_amount
    await connection.query(
      'UPDATE sales SET paid_amount = paid_amount + ?, due_amount = ? WHERE id = ? AND shop_id = ?',
      [actualPayment, newDue, saleId, shopId]
    );

    // 3. Reduce customer due balance
    if (sale.customer_id) {
      await connection.query(
        'UPDATE customers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
        [actualPayment, sale.customer_id, shopId]
      );
    }

    // 4. Record due payment in due_payments
    await connection.query(
      `INSERT INTO due_payments (shop_id, customer_id, sale_id, amount, payment_method, transaction_reference, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [shopId, sale.customer_id || null, saleId, actualPayment, payment_method, transaction_reference || null, note || null]
    );

    await connection.commit();

    res.json({
      message: `Successfully collected payment of ৳${actualPayment.toFixed(2)}.`,
      remaining_due: newDue
    });
  } catch (error) {
    await connection.rollback();
    console.error('Manual order pay-due failed:', error);
    res.status(400).json({ error: error.message || 'Failed to record payment.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
