# InfinityFree Deployment Guide

## Database Setup

The database configuration is already set up in `backend/config/db.php` with your InfinityFree credentials:
- Host: sql107.infinityfree.com
- User: if0_42333746
- Database: if0_42333746_mk_pos

## File Upload Structure

Upload your files to InfinityFree File Manager in this structure:

```
/htdocs/
  ├── backend/
  │   ├── .htaccess
  │   ├── config/
  │   │   └── db.php
  │   ├── controllers/
  │   ├── middleware/
  │   ├── index.php
  │   └── .env (optional - not needed as db.php has hardcoded credentials)
  ├── frontend/
  │   ├── dist/ (build output)
  │   ├── index.html
  │   └── assets/
  └── .htaccess (root level)
```

## Frontend Build

Before uploading, build the frontend:

```bash
cd frontend
npm install
npm run build
```

This will create the `dist` folder that should be uploaded to the server.

## Root .htaccess

Create a `.htaccess` file in the root directory to handle routing:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  
  # Redirect all frontend requests to index.html (SPA routing)
  RewriteCond %{REQUEST_URI} !^/backend/
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ /frontend/index.html [L,QSA]
  
  # Backend API requests
  RewriteRule ^backend/(.*)$ /backend/index.php [L,QSA]
</IfModule>
```

## Database Migrations

The system automatically runs migrations on first connection. The following migrations will be applied:

1. **purchase_order_items table updates:**
   - Renames `quantity` to `quantity_ordered` (if needed)
   - Adds `quantity_received` column
   - Adds `cost_price` column (or renames `unit_price` to `cost_price`)
   - Adds `selling_price` column
   - Adds `subtotal` column
   - Adds `expiry_date` column

2. **purchase_orders table updates:**
   - Adds `payment_basis` column
   - Adds `paid_amount` column
   - Adds `due_amount` column

3. **suppliers table updates:**
   - Adds `due_balance` column

4. **customer_returns table updates:**
   - Adds `amount_deducted_from_due` column

## Troubleshooting Purchase Order Issues

If you still encounter issues with "Create Purchase Order":

1. **Check browser console for errors** - Press F12 and look for JavaScript errors
2. **Check network tab** - Look for failed API requests to `/backend/api/suppliers/purchase-orders`
3. **Verify database structure** - Access phpMyAdmin and check the `purchase_order_items` table has:
   - `quantity_ordered` (INT)
   - `quantity_received` (INT, nullable)
   - `cost_price` (DECIMAL)
   - `selling_price` (DECIMAL, nullable)
   - `subtotal` (DECIMAL)
   - `expiry_date` (DATE, nullable)

4. **Clear browser cache** - Sometimes old JavaScript is cached

5. **Check file permissions** - Ensure PHP files have proper execute permissions

## API Configuration

The frontend automatically detects the API URL:
- Local development: `http://localhost:5000/api`
- Production: Uses the current domain + `/backend/api`

No manual configuration needed for the live site.

## Important Notes

- The database credentials are hardcoded in `backend/config/db.php` for your InfinityFree account
- Do not upload `.env` files to the server (they are protected by .htaccess anyway)
- Always upload the built `frontend/dist` folder, not the source files
- The system will automatically create missing database tables and columns on first run
