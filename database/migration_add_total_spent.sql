-- Migration script to add total_spent and due_balance columns to suppliers table
-- Run this script on existing databases to update the schema

-- Add due_balance column if it doesn't exist
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS due_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER phone;

-- Add total_spent column if it doesn't exist
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER due_balance;

-- Backfill total_spent from existing received purchase orders
UPDATE suppliers s 
SET total_spent = (
    SELECT COALESCE(SUM(po.total_amount), 0)
    FROM purchase_orders po
    WHERE po.supplier_id = s.id 
    AND po.status = 'received'
)
WHERE id IN (
    SELECT DISTINCT supplier_id 
    FROM purchase_orders 
    WHERE status = 'received'
);

-- Backfill due_balance from existing purchase orders with credit payment basis
UPDATE suppliers s 
SET due_balance = (
    SELECT COALESCE(SUM(po.due_amount), 0)
    FROM purchase_orders po
    WHERE po.supplier_id = s.id 
    AND po.status IN ('ordered', 'received')
    AND po.payment_basis = 'credit'
    AND po.due_amount > 0
)
WHERE id IN (
    SELECT DISTINCT supplier_id 
    FROM purchase_orders 
    WHERE status IN ('ordered', 'received')
    AND payment_basis = 'credit'
    AND due_amount > 0
);
