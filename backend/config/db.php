<?php
/**
 * Database Connection & Migrations
 */

class DB {
    private static $pdo = null;

    public static function getConnection() {
        if (self::$pdo === null) {
            /*
             * All credentials are read from environment variables.
             * These are loaded from backend/.env (or the project root .env)
             * by the loadEnv() function in index.php before any controller runs.
             *
             * For local development create backend/.env from backend/.env.example.
             * For production set DB_HOST / DB_USER / DB_PASS / DB_NAME in your
             * hosting panel's environment variable settings (or in backend/.env).
             *
             * Fallback values are safe, non-sensitive local defaults that only
             * apply when no .env file is present (e.g. a fresh clone).
             */
            $host   = getenv('DB_HOST') ?: (isset($_ENV['DB_HOST']) ? $_ENV['DB_HOST'] : '127.0.0.1');
            $user   = getenv('DB_USER') ?: (isset($_ENV['DB_USER']) ? $_ENV['DB_USER'] : 'root');
            $pass   = getenv('DB_PASS') !== false ? getenv('DB_PASS') : (isset($_ENV['DB_PASS']) ? $_ENV['DB_PASS'] : '');
            $dbName = getenv('DB_NAME') ?: (isset($_ENV['DB_NAME']) ? $_ENV['DB_NAME'] : 'multitenant_pos');

            $charset = 'utf8mb4';
            $dsn     = "mysql:host=$host;dbname=$dbName;charset=$charset";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            try {
                self::$pdo = new PDO($dsn, $user, $pass, $options);
                self::$pdo->exec("SET time_zone = '+06:00'");
                self::runMigrations();
            } catch (\PDOException $e) {
                // If the target database doesn't exist yet, create it automatically
                if ($e->getCode() == 1049) {
                    try {
                        $tempDsn = "mysql:host=$host;charset=$charset";
                        $tempPdo = new PDO($tempDsn, $user, $pass, $options);
                        $tempPdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

                        self::$pdo = new PDO($dsn, $user, $pass, $options);
                        self::$pdo->exec("SET time_zone = '+06:00'");
                        self::runMigrations();
                    } catch (\PDOException $ex) {
                        http_response_code(500);
                        header('Content-Type: application/json');
                        echo json_encode(['error' => 'Database creation failed: ' . $ex->getMessage()]);
                        exit;
                    }
                } else {
                    http_response_code(500);
                    header('Content-Type: application/json');
                    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
                    exit;
                }
            }
        }
        return self::$pdo;
    }

    public static function query($sql, $params = []) {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public static function beginTransaction() {
        return self::getConnection()->beginTransaction();
    }

    public static function commit() {
        return self::getConnection()->commit();
    }

    public static function rollBack() {
        return self::getConnection()->rollBack();
    }

    public static function lastInsertId() {
        return self::getConnection()->lastInsertId();
    }

    private static function runMigrations() {
        $pdo = self::$pdo;

        // Helper to check if column exists
        $columnExists = function($table, $column) use ($pdo) {
            try {
                $stmt = $pdo->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
                return $stmt->rowCount() > 0;
            } catch (\PDOException $e) {
                return false;
            }
        };

        // Helper to check if table exists
        $tableExists = function($table) use ($pdo) {
            try {
                $stmt = $pdo->query("SHOW TABLES LIKE '$table'");
                return $stmt->rowCount() > 0;
            } catch (\PDOException $e) {
                return false;
            }
        };

        try {
            // Verify core tables exist
            if (!$tableExists('shops')) {
                // Read from schema.sql if exists to initialize base schema
                $schemaFile = dirname(__DIR__, 2) . '/database/schema.sql';
                if (file_exists($schemaFile)) {
                    $sql = file_get_contents($schemaFile);
                    $pdo->exec($sql);
                }
            }

            // Check if allowed_sections column exists on users table
            if ($tableExists('users') && !$columnExists('users', 'allowed_sections')) {
                $pdo->exec("ALTER TABLE `users` ADD COLUMN `allowed_sections` TEXT NULL");
            }

            // Check if unit column exists on products table
            if ($tableExists('products') && !$columnExists('products', 'unit')) {
                $pdo->exec("ALTER TABLE `products` ADD COLUMN `unit` VARCHAR(20) NOT NULL DEFAULT 'piece'");
            }

            // Check if due_balance column exists on suppliers table
            if ($tableExists('suppliers') && !$columnExists('suppliers', 'due_balance')) {
                $pdo->exec("ALTER TABLE `suppliers` ADD COLUMN `due_balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }

            // Check if payment_basis column exists on purchase_orders table
            if ($tableExists('purchase_orders') && !$columnExists('purchase_orders', 'payment_basis')) {
                $pdo->exec("ALTER TABLE `purchase_orders` ADD COLUMN `payment_basis` ENUM('cash', 'credit') NOT NULL DEFAULT 'cash'");
            }

            // Check if expiry_date column exists on purchase_order_items table
            if ($tableExists('purchase_order_items') && !$columnExists('purchase_order_items', 'expiry_date')) {
                $pdo->exec("ALTER TABLE `purchase_order_items` ADD COLUMN `expiry_date` DATE NULL");
            }

            // Check if quantity_ordered column exists on purchase_order_items table (handle column name mismatch)
            if ($tableExists('purchase_order_items') && $columnExists('purchase_order_items', 'quantity') && !$columnExists('purchase_order_items', 'quantity_ordered')) {
                $pdo->exec("ALTER TABLE `purchase_order_items` CHANGE COLUMN `quantity` `quantity_ordered` INT NOT NULL");
            }

            // Check if quantity_received column exists on purchase_order_items table
            if ($tableExists('purchase_order_items') && !$columnExists('purchase_order_items', 'quantity_received')) {
                $pdo->exec("ALTER TABLE `purchase_order_items` ADD COLUMN `quantity_received` INT NULL");
            }

            // Check if cost_price column exists on purchase_order_items table
            if ($tableExists('purchase_order_items') && !$columnExists('purchase_order_items', 'cost_price')) {
                // If unit_price exists, rename it to cost_price
                if ($columnExists('purchase_order_items', 'unit_price')) {
                    $pdo->exec("ALTER TABLE `purchase_order_items` CHANGE COLUMN `unit_price` `cost_price` DECIMAL(10,2) NOT NULL");
                } else {
                    $pdo->exec("ALTER TABLE `purchase_order_items` ADD COLUMN `cost_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
                }
            }

            // Check if selling_price column exists on purchase_order_items table
            if ($tableExists('purchase_order_items') && !$columnExists('purchase_order_items', 'selling_price')) {
                $pdo->exec("ALTER TABLE `purchase_order_items` ADD COLUMN `selling_price` DECIMAL(10,2) NULL");
            }

            // Check if subtotal column exists on purchase_order_items table
            if ($tableExists('purchase_order_items') && !$columnExists('purchase_order_items', 'subtotal')) {
                $pdo->exec("ALTER TABLE `purchase_order_items` ADD COLUMN `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }

            // Check if paid_amount column exists on purchase_orders table
            if ($tableExists('purchase_orders') && !$columnExists('purchase_orders', 'paid_amount')) {
                $pdo->exec("ALTER TABLE `purchase_orders` ADD COLUMN `paid_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }

            // Check if due_amount column exists on purchase_orders table
            if ($tableExists('purchase_orders') && !$columnExists('purchase_orders', 'due_amount')) {
                $pdo->exec("ALTER TABLE `purchase_orders` ADD COLUMN `due_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }

            // Check if cost_price column exists on sale_items table
            if ($tableExists('sale_items') && !$columnExists('sale_items', 'cost_price')) {
                $pdo->exec("ALTER TABLE `sale_items` ADD COLUMN `cost_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }

            // Create supplier_returns table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `supplier_returns` (
                    `id` INT AUTO_INCREMENT,
                    `shop_id` INT NOT NULL,
                    `supplier_id` INT NOT NULL,
                    `product_id` INT NOT NULL,
                    `quantity` INT NOT NULL,
                    `action_type` ENUM('return', 'replace') NOT NULL,
                    `notes` TEXT NULL,
                    `new_expiry_date` DATE NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    CONSTRAINT `fk_supplier_returns_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_supplier_returns_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_supplier_returns_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // Create customer_returns table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `customer_returns` (
                    `id` INT AUTO_INCREMENT,
                    `shop_id` INT NOT NULL,
                    `customer_id` INT NULL,
                    `sale_id` INT NULL,
                    `product_id` INT NOT NULL,
                    `quantity` INT NOT NULL,
                    `refund_amount` DECIMAL(10,2) NOT NULL,
                    `refund_method` VARCHAR(30) NOT NULL DEFAULT 'cash',
                    `notes` TEXT NULL,
                    `deduct_from_due` TINYINT(1) NOT NULL DEFAULT 0,
                    `amount_deducted_from_due` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    CONSTRAINT `fk_customer_returns_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_customer_returns_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
                    CONSTRAINT `fk_customer_returns_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL,
                    CONSTRAINT `fk_customer_returns_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            if ($tableExists('customer_returns') && !$columnExists('customer_returns', 'refund_method')) {
                $pdo->exec("ALTER TABLE `customer_returns` ADD COLUMN `refund_method` VARCHAR(30) NOT NULL DEFAULT 'cash'");
            }

            if ($tableExists('customer_returns') && !$columnExists('customer_returns', 'amount_deducted_from_due')) {
                $pdo->exec("ALTER TABLE `customer_returns` ADD COLUMN `amount_deducted_from_due` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }

            // Check if logo column exists on users table
            if ($tableExists('users') && !$columnExists('users', 'logo')) {
                $pdo->exec("ALTER TABLE `users` ADD COLUMN `logo` LONGTEXT NULL");
            }

            // Check if logo column exists on shops table
            if ($tableExists('shops') && !$columnExists('shops', 'logo')) {
                $pdo->exec("ALTER TABLE `shops` ADD COLUMN `logo` LONGTEXT NULL");
            }

            // Check if loyalty program columns exist on shops table
            if ($tableExists('shops') && !$columnExists('shops', 'loyalty_enabled')) {
                $pdo->exec("ALTER TABLE `shops` ADD COLUMN `loyalty_enabled` TINYINT(1) NOT NULL DEFAULT 0");
            }
            if ($tableExists('shops') && !$columnExists('shops', 'loyalty_point_earn_rate')) {
                $pdo->exec("ALTER TABLE `shops` ADD COLUMN `loyalty_point_earn_rate` DECIMAL(10,2) NOT NULL DEFAULT 100.00");
            }
            if ($tableExists('shops') && !$columnExists('shops', 'loyalty_point_value')) {
                $pdo->exec("ALTER TABLE `shops` ADD COLUMN `loyalty_point_value` DECIMAL(10,2) NOT NULL DEFAULT 1.00");
            }

            // Check if loyalty_points column exists on customers table
            if ($tableExists('customers') && !$columnExists('customers', 'loyalty_points')) {
                $pdo->exec("ALTER TABLE `customers` ADD COLUMN `loyalty_points` INT NOT NULL DEFAULT 0");
            }

            // Check if loyalty columns exist on sales table
            if ($tableExists('sales') && !$columnExists('sales', 'points_earned')) {
                $pdo->exec("ALTER TABLE `sales` ADD COLUMN `points_earned` INT NOT NULL DEFAULT 0");
            }
            if ($tableExists('sales') && !$columnExists('sales', 'points_redeemed')) {
                $pdo->exec("ALTER TABLE `sales` ADD COLUMN `points_redeemed` INT NOT NULL DEFAULT 0");
            }
            if ($tableExists('sales') && !$columnExists('sales', 'points_redeemed_value')) {
                $pdo->exec("ALTER TABLE `sales` ADD COLUMN `points_redeemed_value` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }

            // Create due_payments table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `due_payments` (
                    `id` INT AUTO_INCREMENT,
                    `shop_id` INT NOT NULL,
                    `customer_id` INT NOT NULL,
                    `sale_id` INT NULL,
                    `amount` DECIMAL(10,2) NOT NULL,
                    `payment_method` ENUM('cash', 'card', 'mobile_pay', 'other') NOT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    CONSTRAINT `fk_due_payments_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_due_payments_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_due_payments_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            if ($tableExists('due_payments') && !$columnExists('due_payments', 'transaction_reference')) {
                $pdo->exec("ALTER TABLE `due_payments` ADD COLUMN `transaction_reference` VARCHAR(255) NULL");
                $pdo->exec("ALTER TABLE `due_payments` ADD COLUMN `note` TEXT NULL");
            }

            // Create other_sales table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `other_sales` (
                    `id` INT AUTO_INCREMENT,
                    `shop_id` INT NOT NULL,
                    `title` VARCHAR(255) NULL,
                    `customer_name` VARCHAR(255) NULL,
                    `customer_phone` VARCHAR(50) NULL,
                    `items` TEXT NULL,
                    `amount` DECIMAL(10,2) NOT NULL,
                    `sale_date` DATE NOT NULL,
                    `notes` TEXT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    CONSTRAINT `fk_other_sales_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            
            // Alter existing table if we just changed the schema (for backwards compatibility during development)
            if ($tableExists('other_sales') && !$columnExists('other_sales', 'items')) {
                $pdo->exec("ALTER TABLE `other_sales` ADD COLUMN `customer_name` VARCHAR(255) NULL");
                $pdo->exec("ALTER TABLE `other_sales` ADD COLUMN `customer_phone` VARCHAR(50) NULL");
                $pdo->exec("ALTER TABLE `other_sales` ADD COLUMN `items` TEXT NULL");
                $pdo->exec("ALTER TABLE `other_sales` CHANGE COLUMN `title` `title` VARCHAR(255) NULL");
            }

            // Create manual_orders table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `manual_orders` (
                    `id` INT AUTO_INCREMENT,
                    `shop_id` INT NOT NULL,
                    `salesman_name` VARCHAR(255) NOT NULL,
                    `customer_id` INT NULL,
                    `customer_name` VARCHAR(255) NULL,
                    `customer_phone` VARCHAR(50) NULL,
                    `customer_address` TEXT NULL,
                    `payment_method` ENUM('cash', 'credit') NOT NULL DEFAULT 'cash',
                    `discount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    `tax` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    `notes` TEXT NULL,
                    `status` ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending',
                    `sale_id` INT NULL,
                    `created_by` INT NOT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    CONSTRAINT `fk_manual_orders_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_manual_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
                    CONSTRAINT `fk_manual_orders_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL,
                    CONSTRAINT `fk_manual_orders_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            if ($tableExists('manual_orders') && !$columnExists('manual_orders', 'customer_name')) {
                $pdo->exec("ALTER TABLE `manual_orders` ADD COLUMN `customer_name` VARCHAR(255) NULL");
                $pdo->exec("ALTER TABLE `manual_orders` ADD COLUMN `customer_phone` VARCHAR(50) NULL");
                $pdo->exec("ALTER TABLE `manual_orders` ADD COLUMN `customer_address` TEXT NULL");
            }

            // Create manual_order_items table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `manual_order_items` (
                    `id` INT AUTO_INCREMENT,
                    `order_id` INT NOT NULL,
                    `shop_id` INT NOT NULL,
                    `product_id` INT NOT NULL,
                    `quantity` INT NOT NULL,
                    `unit_price` DECIMAL(10,2) NOT NULL,
                    `subtotal` DECIMAL(10,2) NOT NULL,
                    PRIMARY KEY (`id`),
                    CONSTRAINT `fk_manual_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `manual_orders` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_manual_order_items_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_manual_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // Create inventory_adjustments table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `inventory_adjustments` (
                    `id` INT AUTO_INCREMENT,
                    `shop_id` INT NOT NULL,
                    `product_id` INT NOT NULL,
                    `previous_quantity` INT NOT NULL,
                    `adjusted_quantity` INT NOT NULL,
                    `difference` INT NOT NULL,
                    `adjustment_type` ENUM('increase', 'decrease') NOT NULL,
                    `reason` VARCHAR(255) NOT NULL,
                    `notes` TEXT NULL,
                    `adjusted_by` INT NOT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    INDEX `idx_inventory_adjustments_shop` (`shop_id`),
                    INDEX `idx_inventory_adjustments_product` (`product_id`),
                    INDEX `idx_inventory_adjustments_date` (`created_at`),
                    CONSTRAINT `fk_inventory_adjustments_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_inventory_adjustments_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_inventory_adjustments_user` FOREIGN KEY (`adjusted_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // Seed Super Admin if no super_admin exists yet
            $stmt = $pdo->query("SELECT COUNT(*) FROM `users` WHERE `role` = 'super_admin'");
            if ($stmt->fetchColumn() == 0) {
                $superAdminPassword = password_hash('123456789', PASSWORD_BCRYPT);
                $seedStmt = $pdo->prepare("
                    INSERT INTO `users` (`name`, `email`, `password_hash`, `role`, `status`)
                    VALUES ('Super Admin', 'mk.rabbani.cse@gmail.com', ?, 'super_admin', 'active')
                ");
                $seedStmt->execute([$superAdminPassword]);
            }

        } catch (\PDOException $e) {
            error_log("Migration error: " . $e->getMessage());
        }
    }
}
