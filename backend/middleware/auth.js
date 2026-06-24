const jwt = require('jsonwebtoken');

/**
 * Middleware to authenticate requests using JWT
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_pos_key_2026');
    req.user = decoded; // Contains id, shop_id, role, name, email

    // Enforce Tenant Isolation:
    // If super_admin, they can query across all shops. They can supply shop_id via query/body parameters.
    // If shop_admin or shop_staff, their shopId is strictly bound to the token's shop_id and cannot be overridden.
    if (req.user.role === 'super_admin') {
      const paramShopId = req.query.shop_id || req.body.shop_id || req.params.shop_id;
      req.shopId = paramShopId ? parseInt(paramShopId) : null;
    } else {
      req.shopId = req.user.shop_id;
    }

    next();
  } catch (error) {
    return res.status(403).json({ error: 'Unauthorized. Invalid or expired token.' });
  }
};

/**
 * Middleware to restrict access based on roles
 * @param {Array<string>} roles - List of allowed roles
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
    }

    next();
  };
};

/**
 * Middleware helper to ensure a tenant context exists (non-super admins must have a valid shopId)
 */
const enforceTenant = (req, res, next) => {
  if (req.user.role !== 'super_admin' && !req.shopId) {
    return res.status(400).json({ error: 'Bad request. Tenant shop identification is missing.' });
  }
  next();
};

module.exports = {
  authenticate,
  authorize,
  enforceTenant
};
