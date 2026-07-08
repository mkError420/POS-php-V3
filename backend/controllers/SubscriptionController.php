<?php
/**
 * Subscription Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

class SubscriptionController {

    /**
     * Get active packages for the public registration page
     */
    public static function listPublicPackages() {
        try {
            $stmt = DB::query("SELECT id, name, price, duration_days, features FROM subscription_packages WHERE status = 'active' ORDER BY price ASC");
            $packages = $stmt->fetchAll();

            foreach ($packages as &$p) {
                $p['id'] = (int)$p['id'];
                $p['price'] = (float)$p['price'];
                $p['duration_days'] = (int)$p['duration_days'];
            }

            header('Content-Type: application/json');
            echo json_encode($packages);

        } catch (\Exception $e) {
            error_log('Fetch public packages error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving subscription packages.', 500);
        }
    }

    /**
     * List all packages for super admin
     */
    public static function listAllPackages() {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        try {
            $stmt = DB::query("SELECT * FROM subscription_packages ORDER BY price ASC");
            $packages = $stmt->fetchAll();

            foreach ($packages as &$p) {
                $p['id'] = (int)$p['id'];
                $p['price'] = (float)$p['price'];
                $p['duration_days'] = (int)$p['duration_days'];
            }

            header('Content-Type: application/json');
            echo json_encode($packages);

        } catch (\Exception $e) {
            error_log('Fetch all packages error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving subscription packages.', 500);
        }
    }

    /**
     * Create a new subscription package
     */
    public static function createPackage($requestData) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        $name = $requestData['name'] ?? '';
        $price = $requestData['price'] ?? '';
        $duration_days = $requestData['duration_days'] ?? 30;
        $features = $requestData['features'] ?? '';
        $status = $requestData['status'] ?? 'active';

        if (empty($name) || $price === '') {
            Auth::jsonError('Package name and price are required.', 400);
        }

        try {
            DB::query(
                "INSERT INTO subscription_packages (name, price, duration_days, features, status) VALUES (?, ?, ?, ?, ?)",
                [$name, (float)$price, (int)$duration_days, $features, $status]
            );

            $packageId = DB::lastInsertId();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Subscription package created successfully.',
                'package_id' => (int)$packageId
            ]);

        } catch (\Exception $e) {
            error_log('Create package error: ' . $e->getMessage());
            Auth::jsonError('Server error creating package.', 500);
        }
    }

    /**
     * Update an existing subscription package
     */
    public static function updatePackage($id, $requestData) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        $name = $requestData['name'] ?? '';
        $price = $requestData['price'] ?? '';
        $duration_days = $requestData['duration_days'] ?? 30;
        $features = $requestData['features'] ?? '';
        $status = $requestData['status'] ?? 'active';

        if (empty($name) || $price === '') {
            Auth::jsonError('Package name and price are required.', 400);
        }

        try {
            // Check package existence
            $stmt = DB::query("SELECT id FROM subscription_packages WHERE id = ?", [$id]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Package not found.', 404);
            }

            DB::query(
                "UPDATE subscription_packages SET name = ?, price = ?, duration_days = ?, features = ?, status = ? WHERE id = ?",
                [$name, (float)$price, (int)$duration_days, $features, $status, $id]
            );

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Subscription package updated successfully.']);

        } catch (\Exception $e) {
            error_log('Update package error: ' . $e->getMessage());
            Auth::jsonError('Server error updating package.', 500);
        }
    }

    /**
     * Delete a subscription package
     */
    public static function deletePackage($id) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        try {
            // Check package existence
            $stmt = DB::query("SELECT id FROM subscription_packages WHERE id = ?", [$id]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Package not found.', 404);
            }

            DB::query("DELETE FROM subscription_packages WHERE id = ?", [$id]);

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Subscription package deleted successfully.']);

        } catch (\Exception $e) {
            error_log('Delete package error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting package. Ensure it is not linked to any active shops.', 500);
        }
    }

    /**
     * Get active payment channel information (bkash, nagad, bank) for public signups
     */
    public static function getPublicPaymentMethods() {
        try {
            $stmt = DB::query("SELECT setting_value FROM system_settings WHERE setting_key = 'payment_methods'");
            $res = $stmt->fetch();
            $data = $res ? json_decode($res['setting_value'], true) : [];
            
            header('Content-Type: application/json');
            echo json_encode($data);
        } catch (\Exception $e) {
            error_log('Get payment methods error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving payment channels.', 500);
        }
    }

    /**
     * Retrieve all system settings for super admin
     */
    public static function getSettings() {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        try {
            $stmt = DB::query("SELECT setting_key, setting_value FROM system_settings");
            $settings = [];
            while ($row = $stmt->fetch()) {
                $settings[$row['setting_key']] = json_decode($row['setting_value'], true) ?: $row['setting_value'];
            }

            header('Content-Type: application/json');
            echo json_encode($settings);
        } catch (\Exception $e) {
            error_log('Get settings error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving system settings.', 500);
        }
    }

    /**
     * Create or update system settings
     */
    public static function updateSettings($requestData) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        try {
            foreach ($requestData as $key => $value) {
                $valStr = is_array($value) ? json_encode($value) : $value;
                DB::query(
                    "INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) 
                     ON DUPLICATE KEY UPDATE setting_value = ?",
                    [$key, $valStr, $valStr]
                );
            }

            header('Content-Type: application/json');
            echo json_encode(['message' => 'System settings updated successfully.']);
        } catch (\Exception $e) {
            error_log('Update settings error: ' . $e->getMessage());
            Auth::jsonError('Server error updating system settings.', 500);
        }
    }

    /**
     * Download SQL Backup for a specific shop database records
     */
    public static function downloadShopBackup($shopId) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        try {
            $pdo = DB::getConnection();

            // Verify if the shop exists
            $stmt = $pdo->prepare("SELECT name FROM shops WHERE id = ?");
            $stmt->execute([$shopId]);
            $shop = $stmt->fetch();
            if (!$shop) {
                Auth::jsonError('Shop not found.', 404);
            }
            $shopName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $shop['name']);

            // Define the tables to back up for the specific shop
            $tables = [
                'shops' => 'id',
                'users' => 'shop_id',
                'products' => 'shop_id',
                'suppliers' => 'shop_id',
                'customers' => 'shop_id',
                'sales' => 'shop_id',
                'sale_items' => 'shop_id',
                'purchase_orders' => 'shop_id',
                'purchase_order_items' => 'shop_id',
                'other_costs' => 'shop_id',
                'other_sales' => 'shop_id',
                'wastages' => 'shop_id',
                'returns' => 'shop_id',
                'held_bills' => 'shop_id',
                'adjustments' => 'shop_id',
                'manual_orders' => 'shop_id',
                'manual_order_items' => 'shop_id',
            ];

            // Verify existing tables
            $existingTables = [];
            $allTablesQuery = $pdo->query("SHOW TABLES");
            while ($row = $allTablesQuery->fetch(PDO::FETCH_NUM)) {
                $existingTables[] = $row[0];
            }

            // Start building SQL content
            $sqlContent = "-- ==================================================\n";
            $sqlContent .= "-- MULTI-TENANT POINT OF SALE SYSTEM SHOP BACKUP\n";
            $sqlContent .= "-- Shop Name: " . $shop['name'] . " (ID: " . $shopId . ")\n";
            $sqlContent .= "-- Exported on BD Time: " . date('Y-m-d H:i:s') . "\n";
            $sqlContent .= "-- ==================================================\n\n";
            $sqlContent .= "SET FOREIGN_KEY_CHECKS=0;\n\n";

            foreach ($tables as $table => $filterCol) {
                if (!in_array($table, $existingTables)) {
                    continue;
                }

                // Query records safely using try-catch to ignore missing columns or tables
                try {
                    if ($table === 'shops') {
                        $stmt = $pdo->prepare("SELECT * FROM `$table` WHERE id = ?");
                    } else {
                        $stmt = $pdo->prepare("SELECT * FROM `$table` WHERE `$filterCol` = ?");
                    }
                    $stmt->execute([$shopId]);
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                } catch (\PDOException $ex) {
                    error_log("Backup warning for table $table: " . $ex->getMessage());
                    continue;
                }

                if (empty($rows)) {
                    $sqlContent .= "-- Table `$table`: No records found for this shop.\n\n";
                    continue;
                }

                $sqlContent .= "-- Dumping data for table `$table` (" . count($rows) . " rows)\n";
                $sqlContent .= "LOCK TABLES `$table` WRITE;\n";

                foreach ($rows as $row) {
                    $cols = array_keys($row);
                    $escapedCols = array_map(function($c) { return "`$c`"; }, $cols);
                    
                    $vals = array_values($row);
                    $escapedVals = array_map(function($v) use ($pdo) {
                        if ($v === null) {
                            return 'NULL';
                        }
                        return $pdo->quote($v);
                    }, $vals);

                    $sqlContent .= "INSERT INTO `$table` (" . implode(', ', $escapedCols) . ") VALUES (" . implode(', ', $escapedVals) . ");\n";
                }

                $sqlContent .= "UNLOCK TABLES;\n\n";
            }

            $sqlContent .= "SET FOREIGN_KEY_CHECKS=1;\n";
            $sqlContent .= "-- END OF BACKUP\n";

            // Serve as attachment download
            $filename = "backup_shop_" . $shopId . "_" . $shopName . "_" . date('Ymd_His') . ".sql";
            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Content-Length: ' . strlen($sqlContent));
            header('Cache-Control: no-cache, no-store, must-revalidate');
            header('Pragma: no-cache');
            header('Expires: 0');
            echo $sqlContent;
            exit;

        } catch (\Exception $e) {
            error_log('Download shop backup error: ' . $e->getMessage());
            Auth::jsonError('Server error generating database backup: ' . $e->getMessage(), 500);
        }
    }
}
