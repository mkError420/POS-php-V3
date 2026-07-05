<?php
/**
 * Product Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

class ProductController {

    public static function listProducts() {
        Auth::authenticate();
        Auth::enforceTenant();

        $search = $_GET['search'] ?? null;
        $low_stock = $_GET['low_stock'] ?? null;
        $expiring = $_GET['expiring'] ?? null;
        $shopId = Auth::$shopId;
        $hasShop = $shopId !== null;

        try {
            $sql = "SELECT p.*, s.name AS supplier_name, sh.name AS shop_name
                    FROM products p
                    LEFT JOIN suppliers s ON p.supplier_id = s.id
                    LEFT JOIN shops sh ON p.shop_id = sh.id
                    WHERE " . ($hasShop ? "p.shop_id = ?" : "1=1");
            
            $params = $hasShop ? [$shopId] : [];

            if (!empty($search)) {
                $sql .= " AND (p.name LIKE ? OR p.sku LIKE ?)";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }

            if ($low_stock === 'true') {
                $sql .= " AND p.stock_quantity <= p.low_stock_threshold";
            }

            if ($expiring === 'true') {
                $sql .= " AND p.expiry_date IS NOT NULL AND p.expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)";
            }

            $latest = $_GET['latest'] ?? null;
            if ($latest !== null) {
                $sql .= " ORDER BY p.created_at DESC, p.id DESC LIMIT " . (int)$latest;
            } else {
                $sql .= " ORDER BY p.name ASC";
            }

            $stmt = DB::query($sql, $params);
            $products = $stmt->fetchAll();

            // Cast numeric fields appropriately
            foreach ($products as &$p) {
                $p['id'] = (int)$p['id'];
                $p['shop_id'] = (int)$p['shop_id'];
                $p['price'] = (float)$p['price'];
                $p['cost_price'] = (float)$p['cost_price'];
                $p['stock_quantity'] = (int)$p['stock_quantity'];
                $p['low_stock_threshold'] = (int)$p['low_stock_threshold'];
                $p['supplier_id'] = $p['supplier_id'] !== null ? (int)$p['supplier_id'] : null;
            }

            header('Content-Type: application/json');
            echo json_encode($products);

        } catch (\Exception $e) {
            error_log('Fetch products error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving products.', 500);
        }
    }

    public static function getProduct($id) {
        Auth::authenticate();
        Auth::enforceTenant();

        $shopId = Auth::$shopId;
        $hasShop = $shopId !== null;

        try {
            $sql = "SELECT p.*, s.name AS supplier_name 
                    FROM products p
                    LEFT JOIN suppliers s ON p.supplier_id = s.id
                    WHERE p.id = ?";
            
            $params = [(int)$id];

            if ($hasShop) {
                $sql .= " AND p.shop_id = ?";
                $params[] = $shopId;
            }

            $stmt = DB::query($sql, $params);
            $product = $stmt->fetch();

            if (!$product) {
                Auth::jsonError('Product not found or access denied.', 404);
            }

            $product['id'] = (int)$product['id'];
            $product['shop_id'] = (int)$product['shop_id'];
            $product['price'] = (float)$product['price'];
            $product['cost_price'] = (float)$product['cost_price'];
            $product['stock_quantity'] = (int)$product['stock_quantity'];
            $product['low_stock_threshold'] = (int)$product['low_stock_threshold'];
            $product['supplier_id'] = $product['supplier_id'] !== null ? (int)$product['supplier_id'] : null;

            header('Content-Type: application/json');
            echo json_encode($product);

        } catch (\Exception $e) {
            error_log('Fetch product by ID error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving product.', 500);
        }
    }

    public static function createProduct($requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;
        $name = $requestData['name'] ?? '';
        $sku = $requestData['sku'] ?? '';
        $price = $requestData['price'] ?? null;
        $cost_price = $requestData['cost_price'] ?? null;
        $stock_quantity = $requestData['stock_quantity'] ?? 0;
        $low_stock_threshold = $requestData['low_stock_threshold'] ?? 10;
        $expiry_date = $requestData['expiry_date'] ?? null;
        $supplier_id = $requestData['supplier_id'] ?? null;
        $unit = $requestData['unit'] ?? 'piece';

        if (empty($name) || empty($sku) || $price === null || $cost_price === null) {
            Auth::jsonError('Please provide name, sku, price, and cost price.', 400);
        }

        try {
            // Check SKU duplicate in the shop
            $stmt = DB::query('SELECT id FROM products WHERE shop_id = ? AND sku = ?', [$shopId, $sku]);
            if ($stmt->fetch()) {
                Auth::jsonError('SKU already exists for this shop.', 400);
            }

            DB::query(
                'INSERT INTO products (shop_id, name, sku, price, cost_price, stock_quantity, low_stock_threshold, expiry_date, supplier_id, unit) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $shopId,
                    $name,
                    $sku,
                    $price,
                    $cost_price,
                    (int)$stock_quantity,
                    (int)$low_stock_threshold,
                    !empty($expiry_date) ? $expiry_date : null,
                    !empty($supplier_id) ? (int)$supplier_id : null,
                    $unit
                ]
            );

            $newProductId = DB::lastInsertId();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Product created successfully.',
                'productId' => (int)$newProductId
            ]);

        } catch (\Exception $e) {
            error_log('Create product error: ' . $e->getMessage());
            Auth::jsonError('Server error creating product.', 500);
        }
    }

    public static function updateProduct($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $productId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            // Verify product belongs to active tenant
            $stmt = DB::query('SELECT id FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Product not found or access denied.', 404);
            }

            // Verify SKU uniqueness if changing SKU
            $sku = $requestData['sku'] ?? null;
            if ($sku !== null) {
                $stmt = DB::query('SELECT id FROM products WHERE shop_id = ? AND sku = ? AND id != ?', [$shopId, $sku, $productId]);
                if ($stmt->fetch()) {
                    Auth::jsonError('Another product with this SKU already exists.', 400);
                }
            }

            // Perform update
            $updateFields = [];
            $params = [];

            $fieldsToUpdate = [
                'name' => 'name',
                'sku' => 'sku',
                'price' => 'price',
                'cost_price' => 'cost_price',
                'stock_quantity' => 'stock_quantity',
                'low_stock_threshold' => 'low_stock_threshold',
                'expiry_date' => 'expiry_date',
                'supplier_id' => 'supplier_id',
                'unit' => 'unit'
            ];

            foreach ($fieldsToUpdate as $apiKey => $dbKey) {
                if (array_key_exists($apiKey, $requestData)) {
                    $val = $requestData[$apiKey];
                    $updateFields[] = "`$dbKey` = ?";
                    if (($dbKey === 'expiry_date' || $dbKey === 'supplier_id') && empty($val)) {
                        $params[] = null;
                    } else {
                        $params[] = $val;
                    }
                }
            }

            if (empty($updateFields)) {
                Auth::jsonError('No update parameters provided.', 400);
            }

            $params[] = $productId;
            $params[] = $shopId;

            DB::query(
                "UPDATE products SET " . implode(', ', $updateFields) . " WHERE id = ? AND shop_id = ?",
                $params
            );

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Product updated successfully.']);

        } catch (\Exception $e) {
            error_log('Update product error: ' . $e->getMessage());
            Auth::jsonError('Server error updating product.', 500);
        }
    }

    public static function deleteProduct($id) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $productId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            // Verify product belongs to active tenant
            $stmt = DB::query('SELECT id FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Product not found or access denied.', 404);
            }

            // Delete product
            DB::query('DELETE FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Product deleted successfully.']);

        } catch (\PDOException $e) {
            error_log('Delete product database error: ' . $e->getMessage());
            // Foreign key constraint violation (ER_ROW_IS_REFERENCED_2 matches SQLSTATE 23000)
            if ($e->getCode() == 23000 || strpos($e->getMessage(), 'a foreign key constraint fails') !== false) {
                Auth::jsonError('Cannot delete product. It is referenced in sales transaction records.', 400);
            }
            Auth::jsonError('Server error deleting product.', 500);
        } catch (\Exception $e) {
            error_log('Delete product error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting product.', 500);
        }
    }

    public static function bulkUploadProducts() {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;

        $forcedSupplierId = null;
        if (isset($_GET['supplier_id']) && $_GET['supplier_id'] !== '') {
            $forcedSupplierId = intval($_GET['supplier_id']);
            // Verify supplier exists and belongs to this shop
            $stmt = DB::query('SELECT id FROM suppliers WHERE id = ? AND shop_id = ?', [$forcedSupplierId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Supplier not found or access denied.', 404);
            }
        }

        if (!isset($_FILES['csv_file']) || $_FILES['csv_file']['error'] !== UPLOAD_ERR_OK) {
            Auth::jsonError('No file uploaded or upload error.', 400);
        }

        $file = $_FILES['csv_file'];
        $filePath = $file['tmp_name'];
        
        // Validate file type
        $fileExtension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if ($fileExtension !== 'csv') {
            Auth::jsonError('Only CSV files are allowed.', 400);
        }

        try {
            DB::beginTransaction();

            $handle = fopen($filePath, 'r');
            if ($handle === false) {
                throw new \Exception('Failed to open CSV file.');
            }

            // Read header row
            $headers = fgetcsv($handle);
            if ($headers === false) {
                throw new \Exception('Failed to read CSV header.');
            }

            // Normalize headers
            $headers = array_map('strtolower', array_map('trim', $headers));
            
            // Expected columns (case-insensitive) - matching user's CSV format
            $columnMap = [
                'name' => self::findColumn(['product name', 'name'], $headers),
                'sku' => self::findColumn(['sku'], $headers),
                'price' => self::findColumn(['sale price', 'price'], $headers),
                'cost_price' => self::findColumn(['cost price', 'cost_price'], $headers),
                'stock_quantity' => self::findColumn(['stock quantity', 'quantity', 'stock'], $headers),
                'low_stock_threshold' => self::findColumn(['low stock threshold', 'low_stock_threshold'], $headers),
                'expiry_date' => self::findColumn(['expiry date', 'expiry_date'], $headers),
                'supplier_id' => self::findColumn(['supplier id', 'supplier_id'], $headers),
                'unit' => self::findColumn(['unit'], $headers)
            ];

            // Debug: log found columns
            error_log('CSV Headers: ' . implode(', ', $headers));
            error_log('Column Map: ' . json_encode($columnMap));

            // Validate required columns
            if ($columnMap['name'] === false || $columnMap['sku'] === false || $columnMap['price'] === false || $columnMap['cost_price'] === false) {
                $missing = [];
                if ($columnMap['name'] === false) $missing[] = 'name (or Product Name)';
                if ($columnMap['sku'] === false) $missing[] = 'sku';
                if ($columnMap['price'] === false) $missing[] = 'price (or Sale Price)';
                if ($columnMap['cost_price'] === false) $missing[] = 'cost_price (or Cost Price)';
                throw new \Exception('CSV must contain columns: ' . implode(', ', $missing) . '. Found columns: ' . implode(', ', $headers));
            }

            $successCount = 0;
            $errorCount = 0;
            $errors = [];
            $rowNumber = 1;

            // Group products by supplier for PO creation
            $productsBySupplier = [];
            $newProductIds = []; // Track new product IDs for cost logs

            while (($row = fgetcsv($handle)) !== false) {
                $rowNumber++;
                
                try {
                    $name = trim($row[$columnMap['name']] ?? '');
                    $sku = trim($row[$columnMap['sku']] ?? '');
                    $price = floatval($row[$columnMap['price']] ?? 0);
                    $costPrice = floatval($row[$columnMap['cost_price']] ?? 0);
                    $stockQuantity = $columnMap['stock_quantity'] !== false ? intval($row[$columnMap['stock_quantity']] ?? 0) : 0;
                    $lowStockThreshold = $columnMap['low_stock_threshold'] !== false ? intval($row[$columnMap['low_stock_threshold']] ?? 10) : 10;
                    $expiryDateRaw = $columnMap['expiry_date'] !== false ? trim($row[$columnMap['expiry_date']] ?? '') : '';
                    $expiryDate = '';
                    // Parse expiry date from various formats
                    if (!empty($expiryDateRaw)) {
                        // Try common date formats
                        $formats = ['Y-m-d', 'd/m/Y', 'm/d/Y', 'Y/m/d', 'd-m-Y', 'm-d-Y', 'Y-m-d', 'd M Y', 'M d Y'];
                        foreach ($formats as $format) {
                            $date = \DateTime::createFromFormat($format, $expiryDateRaw);
                            if ($date !== false) {
                                $expiryDate = $date->format('Y-m-d');
                                break;
                            }
                        }
                        // If still not parsed, try strtotime
                        if (empty($expiryDate)) {
                            $timestamp = strtotime($expiryDateRaw);
                            if ($timestamp !== false) {
                                $expiryDate = date('Y-m-d', $timestamp);
                            }
                        }
                    }
                    $supplierId = $columnMap['supplier_id'] !== false ? trim($row[$columnMap['supplier_id']] ?? '') : '';
                    $unit = $columnMap['unit'] !== false ? trim($row[$columnMap['unit']] ?? 'piece') : 'piece';

                    // Debug: log row data
                    error_log("Row $rowNumber: name='$name', sku='$sku', price=$price, cost_price=$costPrice");

                    // Validate required fields - allow 0 for prices if needed
                    if (empty($name) || empty($sku)) {
                        $errors[] = "Row $rowNumber: Missing required fields (name='$name', sku='$sku')";
                        $errorCount++;
                        continue;
                    }

                    if ($price <= 0) {
                        $errors[] = "Row $rowNumber: Invalid price (must be > 0, got: $price)";
                        $errorCount++;
                        continue;
                    }

                    if ($costPrice <= 0) {
                        $errors[] = "Row $rowNumber: Invalid cost price (must be > 0, got: $costPrice)";
                        $errorCount++;
                        continue;
                    }

                    // Check SKU duplicate (or existing product for upsert)
                    $stmt = DB::query('SELECT id FROM products WHERE shop_id = ? AND sku = ?', [$shopId, $sku]);
                    $existingProduct = $stmt->fetch();

                    // Resolve supplier ID by PO ID, Supplier ID, or Supplier Name
                    $resolvedSupplierId = null;
                    if ($forcedSupplierId !== null) {
                        $resolvedSupplierId = $forcedSupplierId;
                    } else if (!empty($supplierId)) {
                        // 1. Check if it's in the format PO-XXXX (Purchase Order ID)
                        if (preg_match('/^PO[-_ ]?(\d+)$/i', $supplierId, $matches)) {
                            $poId = intval($matches[1]);
                            $stmt = DB::query('SELECT supplier_id FROM purchase_orders WHERE shop_id = ? AND id = ?', [$shopId, $poId]);
                            $po = $stmt->fetch();
                            if ($po && !empty($po['supplier_id'])) {
                                $resolvedSupplierId = intval($po['supplier_id']);
                            }
                        }

                        // 2. If not resolved yet, check if it's a numeric Supplier ID
                        if ($resolvedSupplierId === null && is_numeric($supplierId)) {
                            $stmt = DB::query('SELECT id FROM suppliers WHERE shop_id = ? AND id = ?', [$shopId, intval($supplierId)]);
                            $sup = $stmt->fetch();
                            if ($sup) {
                                $resolvedSupplierId = intval($sup['id']);
                            }
                        }

                        // 3. If not resolved yet, try searching by supplier name
                        if ($resolvedSupplierId === null) {
                            $stmt = DB::query('SELECT id FROM suppliers WHERE shop_id = ? AND name = ?', [$shopId, $supplierId]);
                            $sup = $stmt->fetch();
                            if ($sup) {
                                $resolvedSupplierId = intval($sup['id']);
                            }
                        }

                        // 4. If still not found, automatically create the supplier if it doesn't exist
                        if ($resolvedSupplierId === null) {
                            DB::query(
                                'INSERT INTO suppliers (shop_id, name) VALUES (?, ?)',
                                [$shopId, $supplierId]
                            );
                            $resolvedSupplierId = intval(DB::lastInsertId());
                        }
                    }

                    if ($existingProduct) {
                        // Update existing product
                        DB::query(
                            'UPDATE products 
                             SET name = ?, price = ?, cost_price = ?, stock_quantity = ?, low_stock_threshold = ?, expiry_date = ?, supplier_id = ?, unit = ?
                             WHERE id = ? AND shop_id = ?',
                            [
                                $name,
                                $price,
                                $costPrice,
                                $stockQuantity,
                                $lowStockThreshold,
                                !empty($expiryDate) ? $expiryDate : null,
                                $resolvedSupplierId,
                                $unit,
                                intval($existingProduct['id']),
                                $shopId
                            ]
                        );
                    } else {
                        // Insert product
                        DB::query(
                            'INSERT INTO products (shop_id, name, sku, price, cost_price, stock_quantity, low_stock_threshold, expiry_date, supplier_id, unit) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            [
                                $shopId,
                                $name,
                                $sku,
                                $price,
                                $costPrice,
                                $stockQuantity,
                                $lowStockThreshold,
                                !empty($expiryDate) ? $expiryDate : null,
                                $resolvedSupplierId,
                                $unit
                            ]
                        );

                        $newProductId = DB::lastInsertId();

                        // Track new product for PO creation and cost logs
                        if ($resolvedSupplierId !== null) {
                            if (!isset($productsBySupplier[$resolvedSupplierId])) {
                                $productsBySupplier[$resolvedSupplierId] = [];
                            }
                            $productsBySupplier[$resolvedSupplierId][] = [
                                'product_id' => $newProductId,
                                'name' => $name,
                                'sku' => $sku,
                                'quantity' => $stockQuantity,
                                'cost_price' => $costPrice,
                                'selling_price' => $price,
                                'expiry_date' => !empty($expiryDate) ? $expiryDate : null
                            ];
                            $newProductIds[] = [
                                'product_id' => $newProductId,
                                'supplier_id' => $resolvedSupplierId,
                                'cost_price' => $costPrice
                            ];
                        }
                    }

                    $successCount++;

                } catch (\Exception $e) {
                    $errors[] = "Row $rowNumber: " . $e->getMessage();
                    $errorCount++;
                }
            }

            fclose($handle);

            // Create purchase orders for each supplier as draft for admin to confirm
            foreach ($productsBySupplier as $supplierId => $items) {
                if (empty($items)) continue;

                // Calculate total amount
                $totalAmount = 0.0;
                foreach ($items as $item) {
                    $totalAmount += $item['quantity'] * $item['cost_price'];
                }

                // Create purchase order as draft with paid amount = cost_price * quantity
                DB::query(
                    'INSERT INTO purchase_orders (shop_id, supplier_id, status, total_amount, paid_amount, due_amount, payment_basis, notes, order_date) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [
                        $shopId,
                        $supplierId,
                        'draft',
                        $totalAmount,
                        $totalAmount, // Paid = Cost Price * Stock Quantity
                        0.00, // No due amount since fully paid
                        'cash', // Cash payment basis since fully paid
                        'Auto-generated from CSV bulk upload - pending confirmation',
                    ]
                );
                $poId = DB::lastInsertId();

                // Insert PO items
                foreach ($items as $item) {
                    $subtotal = $item['quantity'] * $item['cost_price'];
                    DB::query(
                        'INSERT INTO purchase_order_items (purchase_order_id, shop_id, product_id, quantity_ordered, quantity_received, cost_price, selling_price, subtotal, expiry_date) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [
                            $poId,
                            $shopId,
                            $item['product_id'],
                            $item['quantity'],
                            0, // quantity_received starts at 0 for draft PO
                            $item['cost_price'],
                            $item['selling_price'],
                            $subtotal,
                            $item['expiry_date']
                        ]
                    );
                }
                // Note: total_spent will be updated when admin confirms/receives the PO
            }

            // Cost logs will be created when PO is received (to avoid duplicates)

            DB::commit();

            header('Content-Type: application/json');
            http_response_code(200);
            echo json_encode([
                'message' => "Bulk upload completed. $successCount products imported successfully, $errorCount failed.",
                'success_count' => $successCount,
                'error_count' => $errorCount,
                'errors' => array_slice($errors, 0, 10) // Return first 10 errors
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Bulk upload error: ' . $e->getMessage());
            Auth::jsonError('Server error during bulk upload: ' . $e->getMessage(), 500);
        }
    }

    private static function findColumn($aliases, $headers) {
        foreach ($aliases as $alias) {
            $index = array_search($alias, $headers);
            if ($index !== false) {
                return $index;
            }
        }
        return false;
    }
}
