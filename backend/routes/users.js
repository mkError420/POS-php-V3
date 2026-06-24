const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticate, authorize, enforceTenant } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/**
 * @route   GET /api/users
 * @desc    Fetch all users globally (Super Admin only)
 * @access  Private (Super Admin)
 */
router.get('/', authorize(['super_admin']), async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.shop_id, u.created_at, s.name as shop_name 
       FROM users u 
       LEFT JOIN shops s ON u.shop_id = s.id 
       ORDER BY u.created_at DESC`
    );
    res.json(users);
  } catch (error) {
    console.error('Fetch global users error:', error);
    res.status(500).json({ error: 'Server error retrieving system users.' });
  }
});

/**
 * @route   POST /api/users
 * @desc    Create a new user globally (Super Admin only)
 * @access  Private (Super Admin)
 */
router.post('/', authorize(['super_admin']), async (req, res) => {
  const { name, email, password, role, shop_id } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Please enter all required fields.' });
  }

  try {
    // Check if email already exists globally
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // If role is super_admin, shop_id must be NULL
    const targetShopId = role === 'super_admin' ? null : (shop_id || null);

    const [result] = await db.query(
      'INSERT INTO users (shop_id, name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, "active")',
      [targetShopId, name, email, passwordHash, role]
    );

    res.status(201).json({ message: 'User created successfully.', id: result.insertId });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Server error creating user.' });
  }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update any user globally (Super Admin only)
 * @access  Private (Super Admin)
 */
router.put('/:id', authorize(['super_admin']), async (req, res) => {
  const userId = req.params.id;
  const { name, email, password, role, status, shop_id } = req.body;

  try {
    const [existing] = await db.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if email already exists for another user
    if (email) {
      const [emailCheck] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (emailCheck.length > 0) {
        return res.status(400).json({ error: 'Email already in use by another user.' });
      }
    }

    const updateFields = [];
    const params = [];

    if (name !== undefined) { updateFields.push('name = ?'); params.push(name); }
    if (email !== undefined) { updateFields.push('email = ?'); params.push(email); }
    if (role !== undefined) { updateFields.push('role = ?'); params.push(role); }
    if (status !== undefined) { updateFields.push('status = ?'); params.push(status); }
    
    // For shop_id, if role changes to super_admin it must be set to null
    if (shop_id !== undefined) {
      updateFields.push('shop_id = ?');
      params.push(role === 'super_admin' ? null : (shop_id || null));
    } else if (role === 'super_admin') {
      updateFields.push('shop_id = NULL');
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(password, salt);
      updateFields.push('password_hash = ?');
      params.push(newHash);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No update fields provided.' });
    }

    params.push(userId);

    await db.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ message: 'User updated successfully.' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error updating user.' });
  }
});

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete any user globally (Super Admin only)
 * @access  Private (Super Admin)
 */
router.delete('/:id', authorize(['super_admin']), async (req, res) => {
  const userId = req.params.id;

  try {
    const [existing] = await db.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Safety: prevent self-deletion
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account.' });
    }

    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ error: 'Cannot delete user. User has associated records in the database. Deactivate their status instead.' });
    }
    res.status(500).json({ error: 'Server error deleting user.' });
  }
});

router.use(enforceTenant);

/**
 * @route   GET /api/users/staff
 * @desc    Get all staff members of the active tenant
 */
router.get('/staff', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  try {
    const [staff] = await db.query(
      'SELECT id, name, email, role, status, allowed_sections, created_at FROM users WHERE shop_id = ? AND role != "super_admin" ORDER BY name ASC',
      [shopId]
    );
    const staffWithParsed = staff.map(s => ({
      ...s,
      allowed_sections: typeof s.allowed_sections === 'string' ? JSON.parse(s.allowed_sections) : (s.allowed_sections || null)
    }));
    res.json(staffWithParsed);
  } catch (error) {
    console.error('Fetch staff error:', error);
    res.status(500).json({ error: 'Server error retrieving staff logs.' });
  }
});

/**
 * @route   POST /api/users/staff
 * @desc    Create a new staff user
 */
router.post('/staff', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const { name, email, password, role, allowed_sections } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Please enter all fields.' });
  }

  if (role === 'super_admin') {
    return res.status(400).json({ error: 'Cannot create super admin user.' });
  }

  try {
    // Check if email already exists globally
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      'INSERT INTO users (shop_id, name, email, password_hash, role, status, allowed_sections) VALUES (?, ?, ?, ?, ?, "active", ?)',
      [shopId, name, email, passwordHash, role, allowed_sections ? JSON.stringify(allowed_sections) : null]
    );

    res.status(201).json({ message: 'Staff user created successfully.', id: result.insertId });
  } catch (error) {
    console.error('Create staff user error:', error);
    res.status(500).json({ error: 'Server error creating staff user.' });
  }
});

/**
 * @route   PUT /api/users/staff/:id
 * @desc    Update a staff user's role or status
 */
router.put('/staff/:id', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const staffId = req.params.id;
  const { name, role, status, password, allowed_sections } = req.body;

  try {
    // Verify target user belongs to same shop
    const [existing] = await db.query(
      'SELECT id, password_hash FROM users WHERE id = ? AND shop_id = ?',
      [staffId, shopId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found or access denied.' });
    }

    const updateFields = [];
    const params = [];

    if (name !== undefined) { updateFields.push('name = ?'); params.push(name); }
    if (role !== undefined) { 
      if (role === 'super_admin') return res.status(400).json({ error: 'Role modification restricted.' });
      updateFields.push('role = ?'); 
      params.push(role); 
    }
    if (status !== undefined) { updateFields.push('status = ?'); params.push(status); }
    if (allowed_sections !== undefined) {
      updateFields.push('allowed_sections = ?');
      params.push(allowed_sections ? JSON.stringify(allowed_sections) : null);
    }
    
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(password, salt);
      updateFields.push('password_hash = ?');
      params.push(newHash);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No update fields provided.' });
    }

    params.push(staffId, shopId);

    await db.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ? AND shop_id = ?`,
      params
    );

    res.json({ message: 'Staff user updated successfully.' });
  } catch (error) {
    console.error('Update staff user error:', error);
    res.status(500).json({ error: 'Server error updating staff user.' });
  }
});

/**
 * @route   DELETE /api/users/staff/:id
 * @desc    Delete a staff user
 */
router.delete('/staff/:id', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const staffId = req.params.id;

  try {
    const [existing] = await db.query(
      'SELECT id FROM users WHERE id = ? AND shop_id = ?',
      [staffId, shopId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found or access denied.' });
    }

    await db.query('DELETE FROM users WHERE id = ? AND shop_id = ?', [staffId, shopId]);
    res.json({ message: 'Staff user deleted successfully.' });
  } catch (error) {
    console.error('Delete staff user error:', error);
    // If referenced in sales
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ error: 'Cannot delete user. Staff has recorded sales. Deactivate their status instead.' });
    }
    res.status(500).json({ error: 'Server error deleting staff user.' });
  }
});

module.exports = router;
