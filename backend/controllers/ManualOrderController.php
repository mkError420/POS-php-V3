<?php
/**
 * Manual Order Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

class ManualOrderController {

    public static function listManualOrders() {
        Auth::authenticate();
        Auth::enforceTenant();

        $shopId = Auth::$shopId;

        try {
            $stmt = DB::query(
                'SELECT mo.*, c.name as customer_name_joined,
                        s.final_amount as sale_final_amount,
                        s.paid_amount as sale_paid_amount,
                        s.due_amount as current_sale_due
                 FROM manual_orders mo 
                 LEFT JOIN customers c ON mo.customer_id = c.id 
                 LEFT JOIN sales s ON mo.sale_id = s.id
                 WHERE mo.shop_id = ? 
                 ORDER BY mo.created_at DESC',
                [$shopId]
            );
            $orders = $stmt->fetchAll();

            foreach ($orders as &$order) {
                $order['id'] = (int)$order['id'];
                $order['shop_id'] = (int)$order['shop_id'];
                $order['customer_id'] = $order['customer_id'] !== null ? (int)$order['customer_id'] : null;
                $order['discount'] = (float)$order['discount'];
                $order['tax'] = (float)$order['tax'];
                $order['sale_id'] = $order['sale_id'] !== null ? (int)$order['sale_id'] : null;
                $order['created_by'] = (int)$order['created_by'];
                $order['sale_final_amount'] = $order['sale_final_amount'] !== null ? (float)$order['sale_final_amount'] : null;
                $order['sale_paid_amount'] = $order['sale_paid_amount'] !== null ? (float)$order['sale_paid_amount'] : null;
                $order['current_sale_due'] = $order['current_sale_due'] !== null ? (float)$order['current_sale_due'] : null;
                
                if ($order['customer_id'] !== null) {
                    $order['customer_name'] = $order['customer_name_joined'] ?: $order['customer_name'];
                }
                unset($order['customer_name_joined']);
            }

            header('Content-Type: application/json');
            echo json_encode($orders);

        } catch (\Exception $e) {
            error_log('Fetch manual orders error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving manual orders.', 500);
        }
    }

    public static function getManualOrder($id) {
        Auth::authenticate();
        Auth::enforceTenant();

        $orderId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            $stmt = DB::query(
                'SELECT mo.*, c.name as customer_name_joined,
                        s.final_amount as sale_final_amount,
                        s.paid_amount as sale_paid_amount,
                        s.due_amount as current_sale_due
                 FROM manual_orders mo 
                 LEFT JOIN customers c ON mo.customer_id = c.id 
                 LEFT JOIN sales s ON mo.sale_id = s.id
                 WHERE mo.id = ? AND mo.shop_id = ?',
                [$orderId, $shopId]
            );
            $order = $stmt->fetch();

            if (!$order) {
                Auth::jsonError('Manual order not found.', 404);
            }

            $order['id'] = (int)$order['id'];
            $order['shop_id'] = (int)$order['shop_id'];
            $order['customer_id'] = $order['customer_id'] !== null ? (int)$order['customer_id'] : null;
            $order['discount'] = (float)$order['discount'];
            $order['tax'] = (float)$order['tax'];
            $order['sale_id'] = $order['sale_id'] !== null ? (int)$order['sale_id'] : null;
            $order['created_by'] = (int)$order['created_by'];
            $order['sale_final_amount'] = $order['sale_final_amount'] !== null ? (float)$order['sale_final_amount'] : null;
            $order['sale_paid_amount'] = $order['sale_paid_amount'] !== null ? (float)$order['sale_paid_amount'] : null;
            $order['current_sale_due'] = $order['current_sale_due'] !== null ? (float)$order['current_sale_due'] : null;

            if ($order['customer_id'] !== null) {
                $order['customer_name'] = $order['customer_name_joined'] ?: $order['customer_name'];
            }
            unset($order['customer_name_joined']);

            // Fetch items
            $stmt = DB::query(
                'SELECT moi.*, p.name as product_name, p.sku as product_sku 
                 FROM manual_order_items moi 
                 JOIN products p ON moi.product_id = p.id 
                 WHERE moi.order_id = ? AND moi.shop_id = ?',
                [$orderId, $shopId]
            );
            $items = $stmt->fetchAll();

            foreach ($items as &$item) {
                $item['id'] = (int)$item['id'];
                $item['order_id'] = (int)$item['order_id'];
                $item['shop_id'] = (int)$item['shop_id'];
                $item['product_id'] = (int)$item['product_id'];
                $item['quantity'] = (int)$item['quantity'];
                $item['unit_price'] = (float)$item['unit_price'];
                $item['subtotal'] = (float)$item['subtotal'];
            }

            $order['items'] = $items;

            header('Content-Type: application/json');
            echo json_encode($order);

        } catch (\Exception $e) {
            error_log('Get manual order error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving manual order details.', 500);
        }
    }

    public static function createManualOrder($requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'shop_staff']);

        $shopId = Auth::$shopId;
        $userId = Auth::$user['id'];

        $salesmanName = $requestData['salesman_name'] ?? Auth::$user['name'];
        $customerId = $requestData['customer_id'] ?? null;
        $customerName = $requestData['customer_name'] ?? null;
        $customerPhone = $requestData['customer_phone'] ?? null;
        $customerAddress = $requestData['customer_address'] ?? null;
        $paymentMethod = $requestData['payment_method'] ?? 'cash';
        $discount = (float)($requestData['discount'] ?? 0.00);
        $tax = (float)($requestData['tax'] ?? 0.00);
        $notes = $requestData['notes'] ?? null;
        $items = $requestData['items'] ?? [];

        if (empty($items) || !is_array($items)) {
            Auth::jsonError('Manual order items are required.', 400);
        }

        try {
            DB::beginTransaction();

            // Insert manual order header
            DB::query(
                'INSERT INTO manual_orders (shop_id, salesman_name, customer_id, customer_name, customer_phone, customer_address, payment_method, discount, tax, notes, status, created_by) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", ?)',
                [
                    $shopId,
                    $salesmanName,
                    $customerId ? (int)$customerId : null,
                    $customerName,
                    $customerPhone,
                    $customerAddress,
                    $paymentMethod,
                    $discount,
                    $tax,
                    $notes,
                    $userId
                ]
            );
            $orderId = DB::lastInsertId();

            // Insert items
            foreach ($items as $item) {
                $productId = (int)$item['product_id'];
                $quantity = (int)$item['quantity'];
                $unitPrice = (float)$item['unit_price'];
                $subtotal = $quantity * $unitPrice;

                DB::query(
                    'INSERT INTO manual_order_items (order_id, shop_id, product_id, quantity, unit_price, subtotal) 
                     VALUES (?, ?, ?, ?, ?, ?)',
                    [$orderId, $shopId, $productId, $quantity, $unitPrice, $subtotal]
                );
            }

            DB::commit();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Manual order created successfully.',
                'order_id' => (int)$orderId
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Create manual order error: ' . $e->getMessage());
            Auth::jsonError('Server error creating manual order.', 500);
        }
    }

    public static function updateManualOrder($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'shop_staff']);

        $orderId = (int)$id;
        $shopId = Auth::$shopId;

        $salesmanName = $requestData['salesman_name'] ?? null;
        $customerId = $requestData['customer_id'] ?? null;
        $customerName = $requestData['customer_name'] ?? null;
        $customerPhone = $requestData['customer_phone'] ?? null;
        $customerAddress = $requestData['customer_address'] ?? null;
        $paymentMethod = $requestData['payment_method'] ?? null;
        $discount = isset($requestData['discount']) ? (float)$requestData['discount'] : null;
        $tax = isset($requestData['tax']) ? (float)$requestData['tax'] : null;
        $notes = $requestData['notes'] ?? null;
        $items = $requestData['items'] ?? null;

        try {
            DB::beginTransaction();

            $stmt = DB::query('SELECT status FROM manual_orders WHERE id = ? AND shop_id = ?', [$orderId, $shopId]);
            $order = $stmt->fetch();

            if (!$order) {
                DB::rollBack();
                Auth::jsonError('Manual order not found.', 404);
            }

            if ($order['status'] !== 'pending') {
                DB::rollBack();
                Auth::jsonError('Only pending manual orders can be updated.', 400);
            }

            // Perform header updates dynamically
            $updateFields = [];
            $params = [];

            $fields = [
                'salesman_name' => $salesmanName,
                'customer_id' => $customerId ? (int)$customerId : null,
                'customer_name' => $customerName,
                'customer_phone' => $customerPhone,
                'customer_address' => $customerAddress,
                'payment_method' => $paymentMethod,
                'discount' => $discount,
                'tax' => $tax,
                'notes' => $notes
            ];

            foreach ($fields as $col => $val) {
                if ($val !== null || array_key_exists($col, $requestData)) {
                    $updateFields[] = "`$col` = ?";
                    $params[] = $val;
                }
            }

            if (!empty($updateFields)) {
                $params[] = $orderId;
                $params[] = $shopId;
                DB::query('UPDATE manual_orders SET ' . implode(', ', $updateFields) . ' WHERE id = ? AND shop_id = ?', $params);
            }

            // Sync items if provided
            if ($items !== null && is_array($items)) {
                DB::query('DELETE FROM manual_order_items WHERE order_id = ? AND shop_id = ?', [$orderId, $shopId]);

                foreach ($items as $item) {
                    $productId = (int)$item['product_id'];
                    $quantity = (int)$item['quantity'];
                    $unitPrice = (float)$item['unit_price'];
                    $subtotal = $quantity * $unitPrice;

                    DB::query(
                        'INSERT INTO manual_order_items (order_id, shop_id, product_id, quantity, unit_price, subtotal) 
                         VALUES (?, ?, ?, ?, ?, ?)',
                        [$orderId, $shopId, $productId, $quantity, $unitPrice, $subtotal]
                    );
                }
            }

            DB::commit();
            header('Content-Type: application/json');
            echo json_encode(['message' => 'Manual order updated successfully.']);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Update manual order error: ' . $e->getMessage());
            Auth::jsonError('Server error updating manual order.', 500);
        }
    }

    public static function deleteManualOrder($id) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'shop_staff']);

        $orderId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            $stmt = DB::query('SELECT status FROM manual_orders WHERE id = ? AND shop_id = ?', [$orderId, $shopId]);
            $order = $stmt->fetch();

            if (!$order) {
                Auth::jsonError('Manual order not found.', 404);
            }

            if ($order['status'] !== 'pending') {
                Auth::jsonError('Only pending manual orders can be deleted.', 400);
            }

            DB::query('DELETE FROM manual_orders WHERE id = ? AND shop_id = ?', [$orderId, $shopId]);

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Manual order deleted successfully.']);

        } catch (\Exception $e) {
            error_log('Delete manual order error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting manual order.', 500);
        }
    }

    public static function confirmManualOrder($id) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'shop_staff']);

        $orderId = (int)$id;
        $shopId = Auth::$shopId;
        $userId = Auth::$user['id'];

        try {
            DB::beginTransaction();

            // Lock manual order
            $stmt = DB::query('SELECT * FROM manual_orders WHERE id = ? AND shop_id = ? FOR UPDATE', [$orderId, $shopId]);
            $order = $stmt->fetch();

            if (!$order) {
                throw new \Exception('Manual order not found.');
            }

            if ($order['status'] !== 'pending') {
                throw new \Exception('This manual order has already been confirmed or processed.');
            }

            // Fetch order items
            $stmt = DB::query('SELECT product_id, quantity, unit_price, subtotal FROM manual_order_items WHERE order_id = ? AND shop_id = ?', [$orderId, $shopId]);
            $orderItems = $stmt->fetchAll();

            if (empty($orderItems)) {
                throw new \Exception('This manual order has no items to process.');
            }

            // Resolve customer
            $resolvedCustomerId = $order['customer_id'] !== null ? (int)$order['customer_id'] : null;

            if (!empty($order['customer_name'])) {
                if (!empty($order['customer_phone'])) {
                    $cStmt = DB::query('SELECT id FROM customers WHERE shop_id = ? AND phone = ? LIMIT 1', [$shopId, $order['customer_phone']]);
                    $customerRow = $cStmt->fetch();
                } else {
                    $cStmt = DB::query('SELECT id FROM customers WHERE shop_id = ? AND name = ? LIMIT 1', [$shopId, $order['customer_name']]);
                    $customerRow = $cStmt->fetch();
                }

                if ($customerRow) {
                    $resolvedCustomerId = (int)$customerRow['id'];
                } else {
                    // Auto-create customer
                    DB::query(
                        'INSERT INTO customers (shop_id, name, phone, address, due_balance) VALUES (?, ?, ?, ?, 0.00)',
                        [$shopId, $order['customer_name'], $order['customer_phone'] ?: null, $order['customer_address'] ?: null]
                    );
                    $resolvedCustomerId = (int)DB::lastInsertId();
                }
            }

            $calculatedTotal = 0.00;
            $validatedItems = [];

            // Lock products & deduct stocks
            foreach ($orderItems as $item) {
                $productId = (int)$item['product_id'];
                $quantity = (int)$item['quantity'];
                $unitPrice = (float)$item['unit_price'];

                $pStmt = DB::query('SELECT id, name, price, cost_price, stock_quantity, low_stock_threshold FROM products WHERE id = ? AND shop_id = ? FOR UPDATE', [$productId, $shopId]);
                $product = $pStmt->fetch();

                if (!$product) {
                    throw new \Exception("Product with ID $productId not found in this shop.");
                }

                if ((int)$product['stock_quantity'] < $quantity) {
                    throw new \Exception("Insufficient stock for product \"{$product['name']}\". Available: {$product['stock_quantity']}, requested: $quantity.");
                }

                $subtotal = $unitPrice * $quantity;
                $calculatedTotal += $subtotal;

                $validatedItems[] = [
                    'product_id' => $productId,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'cost_price' => (float)$product['cost_price'],
                    'subtotal' => $subtotal
                ];

                $newStock = (int)$product['stock_quantity'] - $quantity;
                DB::query('UPDATE products SET stock_quantity = ? WHERE id = ? AND shop_id = ?', [$newStock, $productId, $shopId]);
            }

            $finalAmount = ($calculatedTotal - (float)$order['discount']) + (float)$order['tax'];
            
            $paidAmount = 0.00;
            $dueAmount = 0.00;
            $paymentMethodForSale = 'cash';

            if ($order['payment_method'] === 'cash') {
                $paidAmount = $finalAmount;
                $dueAmount = 0.00;
                $paymentMethodForSale = 'cash';
            } else {
                $paidAmount = 0.00;
                $dueAmount = $finalAmount;
                $paymentMethodForSale = 'other';
            }

            if ($dueAmount > 0 && !$resolvedCustomerId) {
                throw new \Exception('Customer profile details are required to process outstanding credit sales.');
            }

            // Save sale
            DB::query(
                'INSERT INTO sales (shop_id, customer_id, user_id, total_amount, discount, tax, final_amount, paid_amount, due_amount, payment_method) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [$shopId, $resolvedCustomerId, $userId, $calculatedTotal, (float)$order['discount'], (float)$order['tax'], $finalAmount, $paidAmount, $dueAmount, $paymentMethodForSale]
            );
            $saleId = DB::lastInsertId();

            // Save sale items
            foreach ($validatedItems as $item) {
                DB::query(
                    'INSERT INTO sale_items (shop_id, sale_id, product_id, quantity, unit_price, cost_price, subtotal) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [$shopId, $saleId, $item['product_id'], $item['quantity'], $item['unit_price'], $item['cost_price'], $item['subtotal']]
                );
            }

            // Update customer due balance
            if ($dueAmount > 0 && $resolvedCustomerId) {
                DB::query(
                    'UPDATE customers SET due_balance = due_balance + ? WHERE id = ? AND shop_id = ?',
                    [$dueAmount, $resolvedCustomerId, $shopId]
                );
            }

            // Update manual order status
            DB::query(
                'UPDATE manual_orders SET status = "confirmed", sale_id = ?, customer_id = ? WHERE id = ? AND shop_id = ?',
                [$saleId, $resolvedCustomerId, $orderId, $shopId]
            );

            DB::commit();

            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'Manual order confirmed and invoice generated successfully.',
                'sale_id' => (int)$saleId,
                'final_amount' => (float)$finalAmount
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Confirm manual order error: ' . $e->getMessage());
            Auth::jsonError($e->getMessage(), 400);
        }
    }

    public static function payManualOrderSaleDue($saleId, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'shop_staff']);

        $saleId = (int)$saleId;
        $shopId = Auth::$shopId;
        $paymentAmount = (float)($requestData['payment_amount'] ?? 0);
        $paymentMethod = $requestData['payment_method'] ?? 'cash';
        $transactionReference = $requestData['transaction_reference'] ?? null;
        $note = $requestData['note'] ?? null;

        if ($paymentAmount <= 0) {
            Auth::jsonError('Payment amount must be a positive number.', 400);
        }

        $validMethods = ['cash', 'card', 'mobile_pay', 'other'];
        if (!in_array($paymentMethod, $validMethods)) {
            Auth::jsonError('Invalid payment method.', 400);
        }

        try {
            DB::beginTransaction();

            $stmt = DB::query('SELECT * FROM sales WHERE id = ? AND shop_id = ? FOR UPDATE', [$saleId, $shopId]);
            $sale = $stmt->fetch();

            if (!$sale) {
                throw new \Exception('Sale record not found.');
            }

            $currentDue = (float)$sale['due_amount'];

            if ($currentDue <= 0) {
                throw new \Exception('This sale has no outstanding due amount.');
            }

            $actualPayment = min($paymentAmount, $currentDue);
            $newDue = (float)round($currentDue - $actualPayment, 2);

            // Update sale amounts
            DB::query(
                'UPDATE sales SET paid_amount = paid_amount + ?, due_amount = ? WHERE id = ? AND shop_id = ?',
                [$actualPayment, $newDue, $saleId, $shopId]
            );

            // Reduce customer due balance
            if ($sale['customer_id']) {
                DB::query(
                    'UPDATE customers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
                    [$actualPayment, (int)$sale['customer_id'], $shopId]
                );
            }

            // Insert into due_payments
            DB::query(
                'INSERT INTO due_payments (shop_id, customer_id, sale_id, amount, payment_method, transaction_reference, note) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)',
                [$shopId, $sale['customer_id'] ? (int)$sale['customer_id'] : null, $saleId, $actualPayment, $paymentMethod, $transactionReference, $note]
            );

            DB::commit();

            header('Content-Type: application/json');
            echo json_encode([
                'message' => "Successfully collected payment of ৳" . number_format($actualPayment, 2, '.', '') . ".",
                'remaining_due' => $newDue
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Manual order pay-due error: ' . $e->getMessage());
            Auth::jsonError($e->getMessage(), 400);
        }
    }
}
