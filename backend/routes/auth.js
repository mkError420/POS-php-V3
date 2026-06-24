const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get token
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  try {
    // 1. Fetch user by email (also fetch shop status)
    const [users] = await db.query(
      'SELECT u.*, s.name as shop_name, s.status as shop_status FROM users u LEFT JOIN shops s ON u.shop_id = s.id WHERE u.email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = users[0];

    // 2. Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Your account is suspended.' });
    }

    // 3. Check if the user's shop is suspended (skip for super_admin who has no shop)
    if (user.role !== 'super_admin' && user.shop_id && user.shop_status !== 'active') {
      return res.status(403).json({ error: 'This shop has been suspended. Please contact the system administrator.' });
    }

    // 4. Compare passwords
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // 5. Generate JWT
    const allowed_sections = typeof user.allowed_sections === 'string' ? JSON.parse(user.allowed_sections) : (user.allowed_sections || null);
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      shop_id: user.shop_id,
      shop_name: user.shop_name || 'Global System',
      allowed_sections
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'super_secret_pos_key_2026',
      { expiresIn: process.env.JWT_EXPIRE || '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        shop_id: user.shop_id,
        shop_name: user.shop_name || 'Global System',
        allowed_sections,
        logo: user.logo
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get the currently authenticated user's profile
 * @access  Private (all roles)
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT u.id, u.name, u.email, u.role, u.shop_id, u.allowed_sections, u.logo, s.name as shop_name, s.status as shop_status FROM users u LEFT JOIN shops s ON u.shop_id = s.id WHERE u.id = ? AND u.status = "active"',
      [req.user.id]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found or account suspended.' });
    }
    const user = users[0];

    // Check if the shop is suspended (for non-super_admin)
    if (user.role !== 'super_admin' && user.shop_id && user.shop_status !== 'active') {
      return res.status(403).json({ error: 'This shop has been suspended. Please contact the system administrator.' });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      shop_id: user.shop_id,
      shop_name: user.shop_name || 'Global System',
      allowed_sections: typeof user.allowed_sections === 'string' ? JSON.parse(user.allowed_sections) : (user.allowed_sections || null),
      logo: user.logo
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Server error fetching user profile.' });
  }
});

/**
 * @route   PUT /api/auth/me
 * @desc    Update the currently authenticated user's profile (name, email, optional password)
 * @access  Private (all roles)
 */
router.put('/me', authenticate, async (req, res) => {
  const { name, email, password, logo } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  try {
    // 1. Check if email is already in use by another user
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, req.user.id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already in use by another account.' });
    }

    // 2. Prepare update query fields
    const updateFields = ['name = ?', 'email = ?'];
    const queryParams = [name, email];

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      updateFields.push('password_hash = ?');
      queryParams.push(passwordHash);
    }

    if (logo !== undefined) {
      updateFields.push('logo = ?');
      queryParams.push(logo);
    }

    queryParams.push(req.user.id);

    // 3. Execute update
    await db.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ? AND status = 'active'`,
      queryParams
    );

    // 4. Retrieve updated user with shop details
    const [users] = await db.query(
      'SELECT u.id, u.name, u.email, u.role, u.shop_id, u.allowed_sections, u.logo, s.name as shop_name FROM users u LEFT JOIN shops s ON u.shop_id = s.id WHERE u.id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updatedUser = users[0];
    const allowed_sections = typeof updatedUser.allowed_sections === 'string' ? JSON.parse(updatedUser.allowed_sections) : (updatedUser.allowed_sections || null);

    // 5. Generate a new JWT token to keep frontend session updated (excluding the large logo Base64 string from JWT to avoid 431 errors)
    const payload = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      shop_id: updatedUser.shop_id,
      shop_name: updatedUser.shop_name || 'Global System',
      allowed_sections
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'super_secret_pos_key_2026',
      { expiresIn: process.env.JWT_EXPIRE || '8h' }
    );

    res.json({
      message: 'Profile updated successfully.',
      token,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        shop_id: updatedUser.shop_id,
        shop_name: updatedUser.shop_name || 'Global System',
        allowed_sections,
        logo: updatedUser.logo
      }
    });

  } catch (error) {
    console.error('Update me error:', error);
    res.status(500).json({ error: 'Server error updating user profile.' });
  }
});

/**
 * @route   POST /api/auth/register-shop
 * @desc    Super Admin creates a new Shop (Tenant) and its Shop Admin user
 * @access  Private (Super Admin only)
 */
router.post('/register-shop', authenticate, authorize(['super_admin']), async (req, res) => {
  const { shop_name, shop_email, shop_phone, shop_address, admin_name, admin_email, admin_password } = req.body;

  if (!shop_name || !shop_email || !admin_name || !admin_email || !admin_password) {
    return res.status(400).json({ error: 'Please provide all required shop and admin details.' });
  }

  const connection = await db.getConnection();
  try {
    // Start Transaction to ensure atomicity
    await connection.beginTransaction();

    // Check if user email already exists
    const [existingUsers] = await connection.query('SELECT id FROM users WHERE email = ?', [admin_email]);
    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Admin email already exists in the system.' });
    }

    // Check if shop email already exists
    const [existingShops] = await connection.query('SELECT id FROM shops WHERE email = ?', [shop_email]);
    if (existingShops.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Shop email already registered.' });
    }

    // 1. Create the Shop
    const [shopResult] = await connection.query(
      'INSERT INTO shops (name, email, phone, address) VALUES (?, ?, ?, ?)',
      [shop_name, shop_email, shop_phone, shop_address]
    );
    const newShopId = shopResult.insertId;

    // 2. Hash admin password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(admin_password, salt);

    // 3. Create the Shop Admin user linked to the new shop
    await connection.query(
      'INSERT INTO users (shop_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [newShopId, admin_name, admin_email, passwordHash, 'shop_admin']
    );

    // Commit Transaction
    await connection.commit();

    res.status(201).json({
      message: 'Tenant shop and administrator registered successfully.',
      shop_id: newShopId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Register shop transaction error:', error);
    res.status(500).json({ error: 'Failed to create shop and administrator.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
