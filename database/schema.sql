-- MySQL Database DDL for Web-Based Multi-Tenant POS System
-- Core Design: Single Database with 'shop_id' tenant isolation.

CREATE DATABASE IF NOT EXISTS `multitenant_pos`;
USE `multitenant_pos`;

-- -----------------------------------------------------
-- Table `shops` (Tenants)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `shops` (
  `id` INT AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `phone` VARCHAR(20) NULL,
  `address` TEXT NULL,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_shops_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `users` (Super Admin, Shop Admin, Shop Staff)
-- -----------------------------------------------------
-- shop_id is NULL only for super_admin users.
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT,
  `shop_id` INT NULL,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('super_admin', 'shop_admin', 'shop_staff') NOT NULL,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `allowed_sections` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  INDEX `idx_users_shop_role` (`shop_id`, `role`),
  CONSTRAINT `fk_users_shop`
    FOREIGN KEY (`shop_id`)
    REFERENCES `shops` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `suppliers`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` INT AUTO_INCREMENT,
  `shop_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `contact_name` VARCHAR(100) NULL,
  `email` VARCHAR(100) NULL,
  `phone` VARCHAR(20) NULL,
  `due_balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `total_spent` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_suppliers_shop` (`shop_id`),
  CONSTRAINT `fk_suppliers_shop`
    FOREIGN KEY (`shop_id`)
    REFERENCES `shops` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `products`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT AUTO_INCREMENT,
  `shop_id` INT NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `sku` VARCHAR(50) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `cost_price` DECIMAL(10,2) NOT NULL,
  `stock_quantity` INT NOT NULL DEFAULT 0,
  `low_stock_threshold` INT NOT NULL DEFAULT 10,
  `expiry_date` DATE NULL,
  `supplier_id` INT NULL,
  `unit` VARCHAR(20) NOT NULL DEFAULT 'piece',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_shop_sku` (`shop_id`, `sku`), -- SKU is unique per tenant
  INDEX `idx_products_shop_stock` (`shop_id`, `stock_quantity`), -- Alerts search path
  CONSTRAINT `fk_products_shop`
    FOREIGN KEY (`shop_id`)
    REFERENCES `shops` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_products_supplier`
    FOREIGN KEY (`supplier_id`)
    REFERENCES `suppliers` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `customers`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT AUTO_INCREMENT,
  `shop_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NULL,
  `phone` VARCHAR(20) NULL,
  `address` TEXT NULL,
  `due_balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_customers_shop_phone` (`shop_id`, `phone`),
  CONSTRAINT `fk_customers_shop`
    FOREIGN KEY (`shop_id`)
    REFERENCES `shops` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `sales` (Transactions)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales` (
  `id` INT AUTO_INCREMENT,
  `shop_id` INT NOT NULL,
  `customer_id` INT NULL,
  `user_id` INT NOT NULL,
  `total_amount` DECIMAL(10,2) NOT NULL,
  `discount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `tax` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `final_amount` DECIMAL(10,2) NOT NULL,
  `paid_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `due_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `payment_method` ENUM('cash', 'card', 'mobile_pay', 'other') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_sales_shop_date` (`shop_id`, `created_at`), -- Analytics search path
  CONSTRAINT `fk_sales_shop`
    FOREIGN KEY (`shop_id`)
    REFERENCES `shops` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sales_customer`
    FOREIGN KEY (`customer_id`)
    REFERENCES `customers` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sales_user`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `sale_items`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `sale_items` (
  `id` INT AUTO_INCREMENT,
  `shop_id` INT NOT NULL, -- Redundant but critical for partitioned table performance / easy isolation verification
  `sale_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `unit_price` DECIMAL(10,2) NOT NULL,
  `cost_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_sale_items_shop_sale` (`shop_id`, `sale_id`),
  CONSTRAINT `fk_sale_items_shop`
    FOREIGN KEY (`shop_id`)
    REFERENCES `shops` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sale_items_sale`
    FOREIGN KEY (`sale_id`)
    REFERENCES `sales` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sale_items_product`
    FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `purchase_orders`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` INT AUTO_INCREMENT,
  `shop_id` INT NOT NULL,
  `supplier_id` INT NOT NULL,
  `status` ENUM('draft', 'ordered', 'received', 'cancelled') NOT NULL DEFAULT 'draft',
  `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT NULL,
  `payment_basis` ENUM('cash', 'credit') NOT NULL DEFAULT 'cash',
  `paid_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `due_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `received_date` TIMESTAMP NULL,
  `order_date` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_purchase_orders_shop` (`shop_id`),
  INDEX `idx_purchase_orders_supplier` (`supplier_id`),
  CONSTRAINT `fk_purchase_orders_shop`
    FOREIGN KEY (`shop_id`)
    REFERENCES `shops` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_orders_supplier`
    FOREIGN KEY (`supplier_id`)
    REFERENCES `suppliers` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `purchase_order_items`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `id` INT AUTO_INCREMENT,
  `purchase_order_id` INT NOT NULL,
  `shop_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `unit_price` DECIMAL(10,2) NOT NULL,
  `selling_price` DECIMAL(10,2) NULL,
  `subtotal` DECIMAL(10,2) NOT NULL,
  `expiry_date` DATE NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_po_items_order` (`purchase_order_id`),
  CONSTRAINT `fk_po_items_order`
    FOREIGN KEY (`purchase_order_id`)
    REFERENCES `purchase_orders` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_po_items_shop`
    FOREIGN KEY (`shop_id`)
    REFERENCES `shops` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_po_items_product`
    FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `other_costs`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `other_costs` (
  `id` INT AUTO_INCREMENT,
  `shop_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `cost_date` DATE NOT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_other_costs_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `cost_price_logs`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `cost_price_logs` (
  `id` INT AUTO_INCREMENT,
  `shop_id` INT NOT NULL,
  `supplier_id` INT NULL,
  `product_id` INT NOT NULL,
  `old_cost_price` DECIMAL(10,2) NULL,
  `new_cost_price` DECIMAL(10,2) NOT NULL,
  `reason` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_cost_price_logs_shop` (`shop_id`),
  CONSTRAINT `fk_cost_price_logs_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cost_price_logs_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cost_price_logs_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `wastages`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `wastages` (
  `id` INT AUTO_INCREMENT,
  `shop_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `cost_loss` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `reason` VARCHAR(255) NOT NULL,
  `notes` TEXT NULL,
  `adjusted_at` DATE NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_wastages_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wastages_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `held_bills`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `held_bills` (
  `id` INT AUTO_INCREMENT,
  `shop_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `customer_id` INT NULL,
  `customer_name` VARCHAR(100) NULL,
  `customer_phone` VARCHAR(20) NULL,
  `customer_address` TEXT NULL,
  `discount_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `notes` VARCHAR(255) NULL,
  `items` JSON NOT NULL,
  `due_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('held', 'completed', 'cancelled') NOT NULL DEFAULT 'held',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_held_bills_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_held_bills_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_held_bills_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Seed Initial Demo Data (Super Admin)
-- -----------------------------------------------------
-- Password for Super Admin is '123456789' (bcrypt hash used here)
INSERT INTO `users` (`name`, `email`, `password_hash`, `role`, `status`)
VALUES (
  'Super Admin',
  'mk.rabbani.cse@gmail.com',
  '$2a$10$Jek6c.Ov3IBnEWQ45ImT5.XDEI7bmLlsqYL69nFhY.T0zgaGqfsIO',
  'super_admin',
  'active'
) ON DUPLICATE KEY UPDATE `email`=`email`;
