<?php
/**
 * Supplier Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

class SupplierController {

    public static function listSuppliers() {
        Auth::authenticate();
        Auth::enforceTenant();

        $shopId = Auth::$shopId;

        try {
            $stmt = DB::query(
                'SELECT id, name, contact_name, email, phone, due_balance FROM suppliers WHERE shop_id = ? ORDER BY name ASC',
                [$shopId]
            );
            $suppliers = $stmt->fetchAll();

            foreach ($suppliers as &$s) {
                $s['id'] = (int)$s['id'];
                $s['due_balance'] = (float)$s['due_balance'];
            }

            header('Content-Type: application/json');
            echo json_encode($suppliers);

        } catch (\Exception $e) {
            error_log('Fetch suppliers error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving suppliers.', 500);
        }
    }

    public static function createSupplier($requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;
        $name = $requestData['name'] ?? '';
        $contactName = $requestData['contact_name'] ?? null;
        $email = $requestData['email'] ?? null;
        $phone = $requestData['phone'] ?? null;

        if (empty($name)) {
            Auth::jsonError('Supplier name is required.', 400);
        }

        try {
            DB::query(
                'INSERT INTO suppliers (shop_id, name, contact_name, email, phone) VALUES (?, ?, ?, ?, ?)',
                [$shopId, $name, empty($contactName) ? null : $contactName, empty($email) ? null : $email, empty($phone) ? null : $phone]
            );
            $newSupplierId = DB::lastInsertId();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Supplier created successfully.',
                'supplierId' => (int)$newSupplierId
            ]);

        } catch (\Exception $e) {
            error_log('Create supplier error: ' . $e->getMessage());
            Auth::jsonError('Server error creating supplier.', 500);
        }
    }

    public static function listPurchaseOrders() {
        Auth::authenticate();
        Auth::enforceTenant();

        $shopId = Auth::$shopId;
        $status = $_GET['status'] ?? null;
        $supplierId = $_GET['supplier_id'] ?? null;

        try {
            $sql = 'SELECT po.*, s.name AS supplier_name 
                    FROM purchase_orders po 
                    JOIN suppliers s ON po.supplier_id = s.id 
                    WHERE po.shop_id = ?';
            
            $params = [$shopId];

            if (!empty($status)) {
                $sql .= ' AND po.status = ?';
                $params[] = $status;
            }

            if (!empty($supplierId)) {
                $sql .= ' AND po.supplier_id = ?';
                $params[] = (int)$supplierId;
            }

            $sql .= ' ORDER BY po.created_at DESC';

            $stmt = DB::query($sql, $params);
            $pos = $stmt->fetchAll();

            foreach ($pos as &$po) {
                $po['id'] = (int)$po['id'];
                $po['shop_id'] = (int)$po['shop_id'];
                $po['supplier_id'] = (int)$po['supplier_id'];
                $po['total_amount'] = (float)$po['total_amount'];
                $po['paid_amount'] = (float)$po['paid_amount'];
                $po['due_amount'] = (float)$po['due_amount'];
            }

            header('Content-Type: application/json');
            echo json_encode($pos);

        } catch (\Exception $e) {
            error_log('Fetch purchase orders error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving purchase orders.', 500);
        }
    }

    public static function listCostPriceLogs() {
        Auth::authenticate();
        Auth::enforceTenant();

        $shopId = Auth::$shopId;
        $productId = $_GET['product_id'] ?? null;

        try {
            $sql = 'SELECT cpl.*, p.name AS product_name, p.sku AS product_sku, s.name AS supplier_name 
                    FROM cost_price_logs cpl 
                    JOIN products p ON cpl.product_id = p.id 
                    LEFT JOIN suppliers s ON cpl.supplier_id = s.id 
                    WHERE cpl.shop_id = ?';
            
            $params = [$shopId];

            if (!empty($productId)) {
                $sql .= ' AND cpl.product_id = ?';
                $params[] = (int)$productId;
            }

            $sql .= ' ORDER BY cpl.created_at DESC';

            $stmt = DB::query($sql, $params);
            $logs = $stmt->fetchAll();

            foreach ($logs as &$log) {
                $log['id'] = (int)$log['id'];
                $log['shop_id'] = (int)$log['shop_id'];
                $log['product_id'] = (int)$log['product_id'];
                $log['supplier_id'] = $log['supplier_id'] !== null ? (int)$log['supplier_id'] : null;
                $log['old_cost_price'] = $log['old_cost_price'] !== null ? (float)$log['old_cost_price'] : null;
                $log['new_cost_price'] = (float)$log['new_cost_price'];
            }

            header('Content-Type: application/json');
            echo json_encode($logs);

        } catch (\Exception $e) {
            error_log('Fetch cost price logs error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving cost price logs.', 500);
        }
    }

    public static function exportCostPriceLogsCSV() {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;

        try {
            $sql = 'SELECT cpl.id, p.name AS product_name, p.sku AS product_sku, s.name AS supplier_name, 
                           cpl.old_cost_price, cpl.new_cost_price, cpl.reason, cpl.created_at 
                    FROM cost_price_logs cpl 
                    JOIN products p ON cpl.product_id = p.id 
                    LEFT JOIN suppliers s ON cpl.supplier_id = s.id 
                    WHERE cpl.shop_id = ? 
                    ORDER BY cpl.created_at DESC';
            
            $stmt = DB::query($sql, [$shopId]);
            $logs = $stmt->fetchAll();

            if (empty($logs)) {
                Auth::jsonError('No logs found to export.', 404);
            }

            if (ob_get_level()) {
                ob_end_clean();
            }

            header('Content-Type: text/csv');
            header('Content-Disposition: attachment; filename="cost_price_logs_export_' . date('Y-m-d') . '.csv"');
            
            $output = fopen('php://output', 'w');
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
            
            fputcsv($output, ['Log ID', 'Product Name', 'SKU', 'Supplier', 'Old Cost Price', 'New Cost Price', 'Reason', 'Logged At']);

            foreach ($logs as $log) {
                fputcsv($output, [
                    $log['id'],
                    $log['product_name'],
                    $log['product_sku'],
                    $log['supplier_name'] ?: 'N/A',
                    $log['old_cost_price'] !== null ? $log['old_cost_price'] : 'N/A',
                    $log['new_cost_price'],
                    $log['reason'] ?: '',
                    $log['created_at']
                ]);
            }
            fclose($output);
            exit;

        } catch (\Exception $e) {
            error_log('Cost price logs export CSV error: ' . $e->getMessage());
            Auth::jsonError('Server error exporting cost price logs to CSV.', 500);
        }
    }

    public static function exportPurchaseOrdersCSV() {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;

        try {
            $sql = 'SELECT po.id, s.name AS supplier_name, po.status, po.total_amount, po.paid_amount, 
                           po.due_amount, po.payment_basis, po.order_date, po.received_date 
                    FROM purchase_orders po 
                    JOIN suppliers s ON po.supplier_id = s.id 
                    WHERE po.shop_id = ? 
                    ORDER BY po.created_at DESC';
            
            $stmt = DB::query($sql, [$shopId]);
            $pos = $stmt->fetchAll();

            if (empty($pos)) {
                Auth::jsonError('No purchase orders found to export.', 404);
            }

            if (ob_get_level()) {
                ob_end_clean();
            }

            header('Content-Type: text/csv');
            header('Content-Disposition: attachment; filename="purchase_orders_export_' . date('Y-m-d') . '.csv"');
            
            $output = fopen('php://output', 'w');
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
            
            fputcsv($output, ['PO ID', 'Supplier', 'Status', 'Total Value', 'Paid Amount', 'Due Amount', 'Payment Basis', 'Ordered At', 'Received At']);

            foreach ($pos as $po) {
                fputcsv($output, [
                    $po['id'],
                    $po['supplier_name'],
                    $po['status'],
                    $po['total_amount'],
                    $po['paid_amount'],
                    $po['due_amount'],
                    $po['payment_basis'],
                    $po['order_date'],
                    $po['received_date'] ?: 'N/A'
                ]);
            }
            fclose($output);
            exit;

        } catch (\Exception $e) {
            error_log('Purchase orders export CSV error: ' . $e->getMessage());
            Auth::jsonError('Server error exporting purchase orders to CSV.', 500);
        }
    }

    private static function processAndInsertPoItems($poId, $shopId, $supplierId, $items) {
        $normalizedItems = [];
        foreach ($items as $item) {
            $qty = isset($item['quantity']) ? (int)$item['quantity'] : (isset($item['quantity_ordered']) ? (int)$item['quantity_ordered'] : 0);
            $costPrice = isset($item['cost_price']) ? (float)$item['cost_price'] : (isset($item['unit_price']) ? (float)$item['unit_price'] : 0.00);
            $sellingPrice = isset($item['selling_price']) ? (float)$item['selling_price'] : 0.00;
            $productId = isset($item['product_id']) ? (int)$item['product_id'] : null;
            $isNew = isset($item['is_new']) ? (bool)$item['is_new'] : false;
            $name = $item['name'] ?? '';
            $sku = $item['sku'] ?? '';
            $unit = $item['unit'] ?? 'piece';
            $lowStock = $item['low_stock_threshold'] ?? 10;

            $normalizedItems[] = [
                'product_id' => $productId,
                'quantity' => $qty,
                'cost_price' => $costPrice,
                'selling_price' => $sellingPrice,
                'is_new' => $isNew,
                'name' => $name,
                'sku' => $sku,
                'unit' => $unit,
                'low_stock_threshold' => $lowStock
            ];
        }

        $totalAmount = 0.00;
        foreach ($normalizedItems as $item) {
            $totalAmount += $item['quantity'] * $item['cost_price'];
        }

        foreach ($normalizedItems as $item) {
            $productId = $item['product_id'];
            
            if (empty($productId) || $item['is_new']) {
                // Check if product with this SKU already exists
                $stmt = DB::query('SELECT id FROM products WHERE shop_id = ? AND sku = ?', [$shopId, $item['sku']]);
                $existingProd = $stmt->fetch();
                
                if ($existingProd) {
                    $productId = (int)$existingProd['id'];
                } else {
                    // Create the new product in the database with stock_quantity = 0
                    DB::query(
                        'INSERT INTO products (shop_id, name, sku, price, cost_price, stock_quantity, low_stock_threshold, supplier_id, unit) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [
                            $shopId,
                            $item['name'],
                            $item['sku'],
                            $item['selling_price'] > 0 ? $item['selling_price'] : $item['cost_price'],
                            $item['cost_price'],
                            0,
                            (int)$item['low_stock_threshold'],
                            $supplierId,
                            $item['unit']
                        ]
                    );
                    $productId = (int)DB::lastInsertId();
                }
            }

            $subtotal = $item['quantity'] * $item['cost_price'];
            DB::query(
                'INSERT INTO purchase_order_items (purchase_order_id, shop_id, product_id, quantity_ordered, cost_price, selling_price, subtotal) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)',
                [$poId, $shopId, $productId, $item['quantity'], $item['cost_price'], $item['selling_price'], $subtotal]
            );
        }

        return $totalAmount;
    }

    public static function createPurchaseOrder($requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;
        $supplierId = $requestData['supplier_id'] ?? null;
        $status = $requestData['status'] ?? 'draft';
        $notes = $requestData['notes'] ?? null;
        $paymentBasis = $requestData['payment_basis'] ?? 'cash';
        $paidAmount = $requestData['paid_amount'] ?? 0.00;
        $items = $requestData['items'] ?? [];

        if (empty($supplierId) || empty($items) || !is_array($items)) {
            Auth::jsonError('Supplier ID and ordering items are required.', 400);
        }

        if (!in_array($status, ['draft', 'ordered', 'received', 'cancelled'])) {
            Auth::jsonError('Invalid purchase order status.', 400);
        }

        try {
            DB::beginTransaction();

            // Insert PO with temporary total_amount = 0 (will update it after inserting items)
            DB::query(
                'INSERT INTO purchase_orders (shop_id, supplier_id, status, total_amount, paid_amount, due_amount, payment_basis, notes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [$shopId, $supplierId, $status, 0.00, 0.00, 0.00, $paymentBasis, $notes]
            );
            $poId = DB::lastInsertId();

            // Insert items and calculate total amount
            $totalAmount = self::processAndInsertPoItems($poId, $shopId, $supplierId, $items);

            // Calculate paid & due amounts based on payment basis
            if ($paymentBasis === 'credit') {
                $requestedPaidAmount = (float)$paidAmount;
                if ($requestedPaidAmount < 0) {
                    $requestedPaidAmount = 0.00;
                }
                $paidAmount = min($requestedPaidAmount, $totalAmount);
                $dueAmount = $totalAmount - $paidAmount;
            } else {
                $paidAmount = $totalAmount;
                $dueAmount = 0.00;
            }

            // Update main PO with correct totals
            DB::query(
                'UPDATE purchase_orders SET total_amount = ?, paid_amount = ?, due_amount = ? WHERE id = ? AND shop_id = ?',
                [$totalAmount, $paidAmount, $dueAmount, $poId, $shopId]
            );

            // Update supplier due balance if status is ordered or received, payment basis is credit, and due amount > 0
            if (in_array($status, ['ordered', 'received']) && $paymentBasis === 'credit' && $dueAmount > 0) {
                DB::query(
                    'UPDATE suppliers SET due_balance = due_balance + ? WHERE id = ? AND shop_id = ?',
                    [$dueAmount, $supplierId, $shopId]
                );
            }

            DB::commit();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Purchase Order created successfully.',
                'poId' => (int)$poId
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Create PO error: ' . $e->getMessage());
            Auth::jsonError('Server error creating Purchase Order: ' . $e->getMessage(), 500);
        }
    }

    public static function getPurchaseOrder($id) {
        Auth::authenticate();
        Auth::enforceTenant();

        $poId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            // Fetch main PO details
            $stmt = DB::query(
                'SELECT po.*, s.name AS supplier_name 
                 FROM purchase_orders po 
                 JOIN suppliers s ON po.supplier_id = s.id 
                 WHERE po.id = ? AND po.shop_id = ?',
                [$poId, $shopId]
            );
            $po = $stmt->fetch();

            if (!$po) {
                Auth::jsonError('Purchase Order not found.', 404);
            }

            $po['id'] = (int)$po['id'];
            $po['shop_id'] = (int)$po['shop_id'];
            $po['supplier_id'] = (int)$po['supplier_id'];
            $po['total_amount'] = (float)$po['total_amount'];
            $po['paid_amount'] = (float)$po['paid_amount'];
            $po['due_amount'] = (float)$po['due_amount'];

            // Fetch PO items
            $stmt = DB::query(
                'SELECT poi.*, p.name AS product_name, p.sku AS product_sku 
                 FROM purchase_order_items poi 
                 JOIN products p ON poi.product_id = p.id 
                 WHERE poi.purchase_order_id = ? AND poi.shop_id = ?',
                [$poId, $shopId]
            );
            $items = $stmt->fetchAll();

            foreach ($items as &$item) {
                $item['id'] = (int)$item['id'];
                $item['purchase_order_id'] = (int)$item['purchase_order_id'];
                $item['shop_id'] = (int)$item['shop_id'];
                $item['product_id'] = (int)$item['product_id'];
                
                // Handle rename of quantity to quantity_ordered
                $qty = isset($item['quantity_ordered']) ? (int)$item['quantity_ordered'] : (isset($item['quantity']) ? (int)$item['quantity'] : 0);
                $item['quantity_ordered'] = $qty;
                $item['quantity'] = $qty;
                
                $item['cost_price'] = isset($item['cost_price']) ? (float)$item['cost_price'] : (isset($item['unit_price']) ? (float)$item['unit_price'] : 0.00);
                $item['selling_price'] = $item['selling_price'] !== null ? (float)$item['selling_price'] : null;
                $item['subtotal'] = isset($item['subtotal']) ? (float)$item['subtotal'] : ($qty * $item['cost_price']);
                $item['unit_price'] = $item['cost_price']; // Alias for backward compatibility
            }

            $po['items'] = $items;

            header('Content-Type: application/json');
            echo json_encode($po);

        } catch (\Exception $e) {
            error_log('Get PO error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving Purchase Order detail.', 500);
        }
    }

    public static function updatePurchaseOrder($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $poId = (int)$id;
        $shopId = Auth::$shopId;
        $notes = $requestData['notes'] ?? null;
        $items = $requestData['items'] ?? [];

        try {
            DB::beginTransaction();

            // Verify status is draft and retrieve supplier_id
            $stmt = DB::query('SELECT status, supplier_id FROM purchase_orders WHERE id = ? AND shop_id = ?', [$poId, $shopId]);
            $po = $stmt->fetch();

            if (!$po) {
                DB::rollBack();
                Auth::jsonError('Purchase Order not found.', 404);
            }

            if ($po['status'] !== 'draft') {
                DB::rollBack();
                Auth::jsonError('Can only update Purchase Orders in draft status.', 400);
            }

            $supplierId = (int)$po['supplier_id'];

            // Retrieve current PO info to get payment basis & paid amount fallback
            $poStmt = DB::query('SELECT payment_basis, paid_amount FROM purchase_orders WHERE id = ? AND shop_id = ?', [$poId, $shopId]);
            $poInfo = $poStmt->fetch();

            $paymentBasis = $requestData['payment_basis'] ?? ($poInfo ? $poInfo['payment_basis'] : 'cash');
            $requestedPaidAmount = isset($requestData['paid_amount']) ? (float)$requestData['paid_amount'] : ($poInfo ? (float)$poInfo['paid_amount'] : 0.00);

            // Sync items (delete and re-insert)
            DB::query('DELETE FROM purchase_order_items WHERE purchase_order_id = ? AND shop_id = ?', [$poId, $shopId]);

            // Re-insert items and get total amount
            $totalAmount = self::processAndInsertPoItems($poId, $shopId, $supplierId, $items);

            if ($paymentBasis === 'credit') {
                if ($requestedPaidAmount < 0) {
                    $requestedPaidAmount = 0.00;
                }
                $paidAmount = min($requestedPaidAmount, $totalAmount);
                $dueAmount = $totalAmount - $paidAmount;
            } else {
                $paidAmount = $totalAmount;
                $dueAmount = 0.00;
            }

            // Update main PO total
            DB::query(
                'UPDATE purchase_orders SET total_amount = ?, paid_amount = ?, due_amount = ?, payment_basis = ?, notes = ? 
                 WHERE id = ? AND shop_id = ?',
                [$totalAmount, $paidAmount, $dueAmount, $paymentBasis, $notes, $poId, $shopId]
            );

            DB::commit();

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Purchase Order updated successfully.']);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Update PO error: ' . $e->getMessage());
            Auth::jsonError('Server error updating Purchase Order.', 500);
        }
    }

    public static function updatePurchaseOrderStatus($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $poId = (int)$id;
        $shopId = Auth::$shopId;
        $status = $requestData['status'] ?? null;
        $items = $requestData['items'] ?? null;
        $notes = $requestData['notes'] ?? null;

        if (empty($status)) {
            Auth::jsonError('Status is required.', 400);
        }

        try {
            DB::beginTransaction();

            $stmt = DB::query('SELECT * FROM purchase_orders WHERE id = ? AND shop_id = ?', [$poId, $shopId]);
            $po = $stmt->fetch();

            if (!$po) {
                DB::rollBack();
                Auth::jsonError('Purchase Order not found.', 404);
            }

            if ($po['status'] === 'received') {
                DB::rollBack();
                Auth::jsonError('Purchase Order has already been received.', 400);
            }
            if ($po['status'] === 'cancelled') {
                DB::rollBack();
                Auth::jsonError('Purchase Order has already been cancelled.', 400);
            }

            if ($status === 'cancelled') {
                DB::query(
                    'UPDATE purchase_orders SET status = ?, notes = COALESCE(?, notes) WHERE id = ? AND shop_id = ?',
                    ['cancelled', $notes, $poId, $shopId]
                );
                
                if ($po['payment_basis'] === 'credit' && (float)$po['due_amount'] > 0 && ($po['status'] === 'ordered' || $po['status'] === 'received')) {
                    DB::query(
                        'UPDATE suppliers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
                        [(float)$po['due_amount'], $po['supplier_id'], $shopId]
                    );
                }

                DB::commit();
                header('Content-Type: application/json');
                echo json_encode(['message' => 'Purchase Order cancelled.']);
                exit;
            }

            if ($status === 'ordered') {
                DB::query(
                    'UPDATE purchase_orders SET status = ?, notes = COALESCE(?, notes) WHERE id = ? AND shop_id = ?',
                    ['ordered', $notes, $poId, $shopId]
                );

                if ($po['status'] === 'draft' && $po['payment_basis'] === 'credit' && (float)$po['due_amount'] > 0) {
                    DB::query(
                        'UPDATE suppliers SET due_balance = due_balance + ? WHERE id = ? AND shop_id = ?',
                        [(float)$po['due_amount'], $po['supplier_id'], $shopId]
                    );
                }

                DB::commit();
                header('Content-Type: application/json');
                echo json_encode(['message' => 'Purchase Order status set to Ordered.']);
                exit;
            }

            if ($status === 'received') {
                if (empty($items) || !is_array($items)) {
                    DB::rollBack();
                    Auth::jsonError('Received items are required to mark PO as received.', 400);
                }

                DB::query(
                    "UPDATE purchase_orders 
                     SET status = 'received', received_date = CURRENT_TIMESTAMP, notes = COALESCE(?, notes)
                     WHERE id = ? AND shop_id = ?",
                    [$notes, $poId, $shopId]
                );

                if ($po['status'] === 'draft' && $po['payment_basis'] === 'credit' && (float)$po['due_amount'] > 0) {
                    DB::query(
                        'UPDATE suppliers SET due_balance = due_balance + ? WHERE id = ? AND shop_id = ?',
                        [(float)$po['due_amount'], $po['supplier_id'], $shopId]
                    );
                }

                // Update supplier total_spent when PO is received (if column exists)
                $columnCheck = DB::query("SHOW COLUMNS FROM suppliers LIKE 'total_spent'");
                if ($columnCheck->fetch() !== false) {
                    DB::query(
                        'UPDATE suppliers SET total_spent = total_spent + ? WHERE id = ? AND shop_id = ?',
                        [(float)$po['total_amount'], $po['supplier_id'], $shopId]
                    );
                }

                foreach ($items as $item) {
                    $productId = (int)$item['product_id'];
                    $qtyReceived = (int)$item['quantity_received'];
                    $costPrice = (float)$item['cost_price'];
                    $sellingPrice = isset($item['selling_price']) ? (float)$item['selling_price'] : 0.00;
                    $expiryDate = !empty($item['expiry_date']) ? $item['expiry_date'] : null;

                    // Update PO Item quantity received
                    DB::query(
                        'UPDATE purchase_order_items 
                         SET quantity_received = ?, cost_price = ?, selling_price = ?, expiry_date = ?
                         WHERE purchase_order_id = ? AND product_id = ? AND shop_id = ?',
                        [$qtyReceived, $costPrice, $sellingPrice, $expiryDate, $poId, $productId, $shopId]
                    );

                    // Fetch current cost price for log
                    $pStmt = DB::query('SELECT cost_price FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);
                    $prod = $pStmt->fetch();

                    if ($prod) {
                        $oldCost = (float)$prod['cost_price'];
                        
                        // Log price change
                        DB::query(
                            'INSERT INTO cost_price_logs (shop_id, product_id, supplier_id, old_cost_price, new_cost_price, reason)
                             VALUES (?, ?, ?, ?, ?, ?)',
                            [$shopId, $productId, $po['supplier_id'], $oldCost, $costPrice, "PO Received #$poId"]
                        );

                        // Update product stock and cost/selling prices
                        DB::query(
                            'UPDATE products 
                             SET stock_quantity = stock_quantity + ?, cost_price = ?, price = ?, expiry_date = ? 
                             WHERE id = ? AND shop_id = ?',
                            [$qtyReceived, $costPrice, $sellingPrice > 0 ? $sellingPrice : $costPrice, $expiryDate, $productId, $shopId]
                        );
                    }
                }

                DB::commit();
                header('Content-Type: application/json');
                echo json_encode(['message' => 'Purchase Order items successfully received, inventory and cost prices updated!']);
                exit;
            }

            DB::rollBack();
            Auth::jsonError('Invalid status transition requested.', 400);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Receive PO error: ' . $e->getMessage());
            Auth::jsonError('Server error processing PO receiving.', 500);
        }
    }

    public static function deletePurchaseOrder($id) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $poId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            DB::beginTransaction();

            $stmt = DB::query(
                'SELECT status, supplier_id, payment_basis, due_amount, total_amount FROM purchase_orders WHERE id = ? AND shop_id = ?',
                [$poId, $shopId]
            );
            $po = $stmt->fetch();

            if (!$po) {
                DB::rollBack();
                Auth::jsonError('Purchase Order not found.', 404);
            }

            $poStatus = $po['status'];

            // Revert product stocks if received
            if ($poStatus === 'received') {
                $stmt = DB::query(
                    'SELECT product_id, quantity_received FROM purchase_order_items WHERE purchase_order_id = ? AND shop_id = ?',
                    [$poId, $shopId]
                );
                $items = $stmt->fetchAll();

                foreach ($items as $item) {
                    if ((int)$item['quantity_received'] > 0) {
                        DB::query(
                            'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND shop_id = ?',
                            [(int)$item['quantity_received'], (int)$item['product_id'], $shopId]
                        );
                    }
                }
            }

            // Revert supplier balance
            if (($poStatus === 'ordered' || $poStatus === 'received') && $po['payment_basis'] === 'credit' && (float)$po['due_amount'] > 0) {
                DB::query(
                    'UPDATE suppliers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
                    [(float)$po['due_amount'], $po['supplier_id'], $shopId]
                );
            }

            // Revert supplier total_spent if PO was received (if column exists)
            if ($poStatus === 'received') {
                $columnCheck = DB::query("SHOW COLUMNS FROM suppliers LIKE 'total_spent'");
                if ($columnCheck->fetch() !== false) {
                    DB::query(
                        'UPDATE suppliers SET total_spent = GREATEST(total_spent - ?, 0) WHERE id = ? AND shop_id = ?',
                        [(float)$po['total_amount'], $po['supplier_id'], $shopId]
                    );
                }
            }

            DB::query('DELETE FROM purchase_orders WHERE id = ? AND shop_id = ?', [$poId, $shopId]);

            DB::commit();
            header('Content-Type: application/json');
            echo json_encode(['message' => 'Purchase Order deleted successfully.']);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Delete PO error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting Purchase Order.', 500);
        }
    }

    public static function deletePurchaseOrderItem($id, $productId) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $poId = (int)$id;
        $productId = (int)$productId;
        $shopId = Auth::$shopId;

        try {
            DB::beginTransaction();

            $stmt = DB::query('SELECT status FROM purchase_orders WHERE id = ? AND shop_id = ?', [$poId, $shopId]);
            $po = $stmt->fetch();

            if (!$po) {
                DB::rollBack();
                Auth::jsonError('Purchase Order not found.', 404);
            }

            $status = $po['status'];
            if ($status === 'received' || $status === 'cancelled') {
                DB::rollBack();
                Auth::jsonError("Cannot delete items from a $status Purchase Order.", 400);
            }

            // Check existence in items
            $stmt = DB::query(
                'SELECT id FROM purchase_order_items WHERE purchase_order_id = ? AND product_id = ? AND shop_id = ?',
                [$poId, $productId, $shopId]
            );
            if (!$stmt->fetch()) {
                DB::rollBack();
                Auth::jsonError('Product not found in this Purchase Order.', 404);
            }

            // Check count of items
            $stmt = DB::query(
                'SELECT COUNT(*) AS cnt FROM purchase_order_items WHERE purchase_order_id = ? AND shop_id = ?',
                [$poId, $shopId]
            );
            if ($stmt->fetchColumn() <= 1) {
                DB::rollBack();
                Auth::jsonError('Cannot delete the last product from a Purchase Order. Delete the Purchase Order instead.', 400);
            }

            DB::query(
                'DELETE FROM purchase_order_items WHERE purchase_order_id = ? AND product_id = ? AND shop_id = ?',
                [$poId, $productId, $shopId]
            );

            // Recompute PO total
            $stmt = DB::query(
                'SELECT SUM(quantity_ordered * cost_price) AS total FROM purchase_order_items WHERE purchase_order_id = ? AND shop_id = ?',
                [$poId, $shopId]
            );
            $newTotal = (float)($stmt->fetchColumn() ?: 0.00);

            // Fetch current PO info
            $poStmt = DB::query('SELECT status, payment_basis, paid_amount, due_amount, supplier_id FROM purchase_orders WHERE id = ? AND shop_id = ?', [$poId, $shopId]);
            $poInfo = $poStmt->fetch();
            
            $poStatus = $poInfo['status'];
            $paymentBasis = $poInfo['payment_basis'];
            $oldPaid = (float)$poInfo['paid_amount'];
            $oldDue = (float)$poInfo['due_amount'];
            $supplierId = (int)$poInfo['supplier_id'];

            if ($paymentBasis === 'credit') {
                $newPaid = min($oldPaid, $newTotal);
                $newDue = $newTotal - $newPaid;
            } else {
                $newPaid = $newTotal;
                $newDue = 0.00;
            }

            DB::query(
                'UPDATE purchase_orders SET total_amount = ?, paid_amount = ?, due_amount = ? WHERE id = ? AND shop_id = ?',
                [$newTotal, $newPaid, $newDue, $poId, $shopId]
            );

            // Adjust supplier due balance if the PO status is ordered or received
            if (in_array($poStatus, ['ordered', 'received']) && $paymentBasis === 'credit') {
                $dueDifference = $oldDue - $newDue;
                if ($dueDifference != 0.00) {
                    DB::query(
                        'UPDATE suppliers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
                        [$dueDifference, $supplierId, $shopId]
                    );
                }
            }

            DB::commit();

            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'Product successfully removed from Purchase Order.',
                'newTotal' => (float)$newTotal
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Delete PO item error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting Purchase Order item.', 500);
        }
    }

    public static function getSupplierProfile($id) {
        Auth::authenticate();
        Auth::enforceTenant();

        $supplierId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            // Check if total_spent column exists
            $columnCheck = DB::query("SHOW COLUMNS FROM suppliers LIKE 'total_spent'");
            $hasTotalSpent = $columnCheck->fetch() !== false;

            // Supplier main profile - backward compatible query
            if ($hasTotalSpent) {
                $stmt = DB::query(
                    'SELECT id, name, contact_name, email, phone, due_balance, total_spent, created_at FROM suppliers WHERE id = ? AND shop_id = ?',
                    [$supplierId, $shopId]
                );
            } else {
                $stmt = DB::query(
                    'SELECT id, name, contact_name, email, phone, due_balance, created_at FROM suppliers WHERE id = ? AND shop_id = ?',
                    [$supplierId, $shopId]
                );
            }
            $supplier = $stmt->fetch();

            if (!$supplier) {
                Auth::jsonError('Supplier profile not found.', 404);
            }

            $supplier['id'] = (int)$supplier['id'];
            $supplier['due_balance'] = isset($supplier['due_balance']) ? (float)$supplier['due_balance'] : 0.00;

            // Check if total_spent column exists
            $columnCheck = DB::query("SHOW COLUMNS FROM suppliers LIKE 'total_spent'");
            $hasTotalSpentColumn = $columnCheck->fetch() !== false;

            if ($hasTotalSpentColumn) {
                $supplier['total_spent'] = isset($supplier['total_spent']) ? (float)$supplier['total_spent'] : 0.00;
            } else {
                $supplier['total_spent'] = 0.00; // Will be calculated from POs below
            }

            // Purchase orders list
            $stmt = DB::query(
                'SELECT id, status, total_amount, paid_amount, due_amount, payment_basis, order_date, received_date 
                 FROM purchase_orders 
                 WHERE supplier_id = ? AND shop_id = ? 
                 ORDER BY created_at DESC',
                [$supplierId, $shopId]
            );
            $pos = $stmt->fetchAll();

            // Calculate total_spent dynamically from received POs if column doesn't exist
            $totalSpent = 0.0;
            if (!$hasTotalSpentColumn) {
                foreach ($pos as $po) {
                    if ($po['status'] === 'received') {
                        $totalSpent += (float)$po['total_amount'];
                    }
                }
                $supplier['total_spent'] = $totalSpent;
            } else {
                $totalSpent = (float)$supplier['total_spent'];
            }
            $poStats = [
                'received' => 0,
                'draft' => 0,
                'ordered' => 0,
                'cancelled' => 0
            ];

            foreach ($pos as &$po) {
                $po['id'] = (int)$po['id'];
                $po['total_amount'] = (float)$po['total_amount'];
                $po['paid_amount'] = (float)$po['paid_amount'];
                $po['due_amount'] = (float)$po['due_amount'];

                $status = $po['status'];
                if (isset($poStats[$status])) {
                    $poStats[$status]++;
                } else {
                    $poStats[$status] = 1;
                }
            }

            // Cost logs list
            $stmt = DB::query(
                'SELECT cpl.*, p.name AS product_name, p.sku AS product_sku 
                 FROM cost_price_logs cpl 
                 JOIN products p ON cpl.product_id = p.id 
                 WHERE cpl.supplier_id = ? AND cpl.shop_id = ? 
                 ORDER BY cpl.created_at DESC',
                [$supplierId, $shopId]
            );
            $costLogs = $stmt->fetchAll();
            foreach ($costLogs as &$log) {
                $log['id'] = (int)$log['id'];
                $log['shop_id'] = (int)$log['shop_id'];
                $log['product_id'] = (int)$log['product_id'];
                $log['supplier_id'] = (int)$log['supplier_id'];
                $log['old_cost_price'] = $log['old_cost_price'] !== null ? (float)$log['old_cost_price'] : null;
                $log['new_cost_price'] = (float)$log['new_cost_price'];
            }

            // Expired products list
            $stmt = DB::query(
                'SELECT id, name, sku, expiry_date, stock_quantity 
                 FROM products 
                 WHERE supplier_id = ? AND shop_id = ? AND expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE()',
                [$supplierId, $shopId]
            );
            $expiredProducts = $stmt->fetchAll();
            foreach ($expiredProducts as &$ep) {
                $ep['id'] = (int)$ep['id'];
                $ep['stock_quantity'] = (int)$ep['stock_quantity'];
            }

            // Return logs (Returns & replacements history)
            $stmt = DB::query(
                'SELECT sr.*, p.name AS product_name, p.sku AS product_sku 
                 FROM supplier_returns sr 
                 JOIN products p ON sr.product_id = p.id 
                 WHERE sr.supplier_id = ? AND sr.shop_id = ? 
                 ORDER BY sr.created_at DESC',
                [$supplierId, $shopId]
            );
            $returns = $stmt->fetchAll();

            foreach ($returns as &$ret) {
                $ret['id'] = (int)$ret['id'];
                $ret['shop_id'] = (int)$ret['shop_id'];
                $ret['supplier_id'] = (int)$ret['supplier_id'];
                $ret['product_id'] = (int)$ret['product_id'];
                $ret['quantity'] = (int)$ret['quantity'];
            }

            $response = [
                'supplier' => $supplier,
                'stats' => [
                    'totalSpent' => $totalSpent,
                    'poStats' => $poStats
                ],
                'purchaseOrders' => $pos,
                'costLogs' => $costLogs,
                'expiredProducts' => $expiredProducts,
                'returnsHistory' => $returns
            ];

            header('Content-Type: application/json');
            echo json_encode($response);

        } catch (\Exception $e) {
            error_log('Get supplier profile error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving supplier details.', 500);
        }
    }

    public static function updateSupplier($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $supplierId = (int)$id;
        $shopId = Auth::$shopId;
        $name = $requestData['name'] ?? '';
        $contactName = $requestData['contact_name'] ?? null;
        $email = $requestData['email'] ?? null;
        $phone = $requestData['phone'] ?? null;

        if (empty($name)) {
            Auth::jsonError('Supplier name is required.', 400);
        }

        try {
            $stmt = DB::query('SELECT id FROM suppliers WHERE id = ? AND shop_id = ?', [$supplierId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Supplier not found or access denied.', 404);
            }

            DB::query(
                'UPDATE suppliers SET name = ?, contact_name = ?, email = ?, phone = ? WHERE id = ? AND shop_id = ?',
                [$name, $contactName, $email, $phone, $supplierId, $shopId]
            );

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Supplier details updated.']);

        } catch (\Exception $e) {
            error_log('Update supplier error: ' . $e->getMessage());
            Auth::jsonError('Server error updating supplier profile.', 500);
        }
    }

    public static function deleteSupplier($id) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $supplierId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            $stmt = DB::query('SELECT id FROM suppliers WHERE id = ? AND shop_id = ?', [$supplierId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Supplier not found or access denied.', 404);
            }

            DB::query('DELETE FROM suppliers WHERE id = ? AND shop_id = ?', [$supplierId, $shopId]);

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Supplier profile deleted successfully.']);

        } catch (\PDOException $e) {
            error_log('Delete supplier DB error: ' . $e->getMessage());
            if ($e->getCode() == 23000 || strpos($e->getMessage(), 'a foreign key constraint fails') !== false) {
                Auth::jsonError('Cannot delete supplier. Supplier is referenced in existing purchase orders.', 400);
            }
            Auth::jsonError('Server error deleting supplier.', 500);
        } catch (\Exception $e) {
            error_log('Delete supplier error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting supplier.', 500);
        }
    }

    public static function payPurchaseOrder($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $poId = (int)$id;
        $shopId = Auth::$shopId;
        $amount = isset($requestData['amount']) ? (float)$requestData['amount'] : 0;

        if ($amount <= 0) {
            Auth::jsonError('Please provide a valid payment amount (must be greater than 0).', 400);
        }

        try {
            DB::beginTransaction();

            $stmt = DB::query('SELECT * FROM purchase_orders WHERE id = ? AND shop_id = ?', [$poId, $shopId]);
            $po = $stmt->fetch();

            if (!$po) {
                DB::rollBack();
                Auth::jsonError('Purchase Order not found.', 404);
            }

            $currentDue = (float)$po['due_amount'];

            if ($currentDue <= 0) {
                DB::rollBack();
                Auth::jsonError('This Purchase Order has no outstanding due balance.', 400);
            }

            $paymentAmount = min($amount, $currentDue);
            $newDue = $currentDue - $paymentAmount;
            $newPaid = (float)$po['paid_amount'] + $paymentAmount;

            // Update PO amounts
            DB::query(
                'UPDATE purchase_orders SET paid_amount = ?, due_amount = ? WHERE id = ? AND shop_id = ?',
                [$newPaid, $newDue, $poId, $shopId]
            );

            // Revert supplier balance if the PO was in credit
            if ($po['payment_basis'] === 'credit') {
                DB::query(
                    'UPDATE suppliers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
                    [$paymentAmount, $po['supplier_id'], $shopId]
                );
            }

            DB::commit();

            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'Payment registered successfully.',
                'paid_amount' => $paymentAmount,
                'due_remaining' => $newDue
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Pay PO error: ' . $e->getMessage());
            Auth::jsonError('Server error recording PO payment.', 500);
        }
    }

    public static function createSupplierReturn($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $supplierId = (int)$id;
        $shopId = Auth::$shopId;
        $productId = $requestData['product_id'] ?? null;
        $quantity = (int)($requestData['quantity'] ?? 0);
        $actionType = $requestData['action_type'] ?? 'return'; // return / replace
        $notes = $requestData['notes'] ?? null;
        $newExpiryDate = $requestData['new_expiry_date'] ?? null;

        if (empty($productId) || $quantity <= 0) {
            Auth::jsonError('Product ID and valid quantity are required.', 400);
        }

        try {
            DB::beginTransaction();

            // Verify product belongs to shop
            $stmt = DB::query('SELECT stock_quantity FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);
            $prod = $stmt->fetch();

            if (!$prod) {
                DB::rollBack();
                Auth::jsonError('Product not found in this shop.', 404);
            }

            if ($actionType === 'return' && (int)$prod['stock_quantity'] < $quantity) {
                DB::rollBack();
                Auth::jsonError('Insufficient stock quantity to perform this return.', 400);
            }

            // Record return log
            DB::query(
                'INSERT INTO supplier_returns (shop_id, supplier_id, product_id, quantity, action_type, notes, new_expiry_date) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)',
                [$shopId, $supplierId, $productId, $quantity, $actionType, $notes, !empty($newExpiryDate) ? $newExpiryDate : null]
            );
            $logId = DB::lastInsertId();

            if ($actionType === 'return') {
                // Deduct stock
                DB::query(
                    'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND shop_id = ?',
                    [$quantity, $productId, $shopId]
                );
            } else if ($actionType === 'replace' && !empty($newExpiryDate)) {
                // Update expiry date on replace
                DB::query(
                    'UPDATE products SET expiry_date = ? WHERE id = ? AND shop_id = ?',
                    [$newExpiryDate, $productId, $shopId]
                );
            }

            DB::commit();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Supplier return action registered.',
                'log_id' => (int)$logId
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Create supplier return error: ' . $e->getMessage());
            Auth::jsonError('Server error registering supplier return.', 500);
        }
    }

    public static function updateSupplierReturn($logId, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $logId = (int)$logId;
        $shopId = Auth::$shopId;
        $quantity = (int)($requestData['quantity'] ?? 0);
        $notes = $requestData['notes'] ?? null;
        $newExpiryDate = $requestData['new_expiry_date'] ?? null;

        if ($quantity <= 0) {
            Auth::jsonError('Valid quantity is required.', 400);
        }

        try {
            DB::beginTransaction();

            $stmt = DB::query('SELECT * FROM supplier_returns WHERE id = ? AND shop_id = ?', [$logId, $shopId]);
            $log = $stmt->fetch();

            if (!$log) {
                DB::rollBack();
                Auth::jsonError('Return log entry not found.', 404);
            }

            $productId = $log['product_id'];
            $oldQty = (int)$log['quantity'];

            if ($log['action_type'] === 'return') {
                // Verify inventory adjustment difference
                $pStmt = DB::query('SELECT stock_quantity FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);
                $prod = $pStmt->fetch();

                $netDifference = $quantity - $oldQty;

                if ($prod && (int)$prod['stock_quantity'] < $netDifference) {
                    DB::rollBack();
                    Auth::jsonError('Insufficient stock quantity to update this return.', 400);
                }

                // Adjust product stock
                DB::query(
                    'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND shop_id = ?',
                    [$netDifference, $productId, $shopId]
                );
            }

            // Update log
            DB::query(
                'UPDATE supplier_returns SET quantity = ?, notes = ?, new_expiry_date = ? 
                 WHERE id = ? AND shop_id = ?',
                [$quantity, $notes, !empty($newExpiryDate) ? $newExpiryDate : null, $logId, $shopId]
            );

            if ($log['action_type'] === 'replace' && !empty($newExpiryDate)) {
                DB::query(
                    'UPDATE products SET expiry_date = ? WHERE id = ? AND shop_id = ?',
                    [$newExpiryDate, $productId, $shopId]
                );
            }

            DB::commit();

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Supplier return action updated.']);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Update supplier return error: ' . $e->getMessage());
            Auth::jsonError('Server error updating return action.', 500);
        }
    }

    public static function deleteSupplierReturn($logId) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $logId = (int)$logId;
        $shopId = Auth::$shopId;

        try {
            DB::beginTransaction();

            $stmt = DB::query('SELECT * FROM supplier_returns WHERE id = ? AND shop_id = ?', [$logId, $shopId]);
            $log = $stmt->fetch();

            if (!$log) {
                DB::rollBack();
                Auth::jsonError('Return log entry not found.', 404);
            }

            // If return action, restore stock quantity
            if ($log['action_type'] === 'return') {
                DB::query(
                    'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND shop_id = ?',
                    [(int)$log['quantity'], $log['product_id'], $shopId]
                );
            }

            DB::query('DELETE FROM supplier_returns WHERE id = ? AND shop_id = ?', [$logId, $shopId]);

            DB::commit();

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Supplier return action deleted and inventory reverted.']);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Delete supplier return error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting return action.', 500);
        }
    }
}
