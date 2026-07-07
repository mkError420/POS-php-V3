<?php
/**
 * Held Bill Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

class HeldBillController {

    public static function listHeldBills() {
        Auth::authenticate();
        Auth::enforceTenant();

        $shopId = Auth::$shopId;

        try {
            $stmt = DB::query(
                'SELECT hb.*, c.name AS customer_name_joined, c.phone AS customer_phone_joined 
                 FROM held_bills hb 
                 LEFT JOIN customers c ON hb.customer_id = c.id 
                 WHERE hb.shop_id = ?
                 ORDER BY hb.created_at DESC',
                [$shopId]
            );
            $bills = $stmt->fetchAll();

            foreach ($bills as &$bill) {
                $bill['id'] = (int)$bill['id'];
                $bill['shop_id'] = (int)$bill['shop_id'];
                $bill['user_id'] = (int)$bill['user_id'];
                $bill['customer_id'] = $bill['customer_id'] !== null ? (int)$bill['customer_id'] : null;
                $bill['discount_percent'] = (float)$bill['discount_percent'];
                $bill['due_amount'] = (float)$bill['due_amount'];
                
                // If items is JSON string, decode it
                if (is_string($bill['items'])) {
                    $bill['items'] = json_decode($bill['items'], true);
                }

                // Fallback details
                if ($bill['customer_id'] !== null) {
                    $bill['customer_name'] = $bill['customer_name_joined'] ?: $bill['customer_name'];
                    $bill['customer_phone'] = $bill['customer_phone_joined'] ?: $bill['customer_phone'];
                }
                unset($bill['customer_name_joined'], $bill['customer_phone_joined']);
            }

            header('Content-Type: application/json');
            echo json_encode($bills);

        } catch (\Exception $e) {
            error_log('Fetch held bills error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving held bills list.', 500);
        }
    }

    public static function createHeldBill($requestData) {
        Auth::authenticate();
        Auth::enforceTenant(true);
        Auth::authorize(['shop_admin', 'shop_staff']);

        $shopId = Auth::$shopId;
        $userId = Auth::$user['id'];

        $customerId = $requestData['customer_id'] ?? null;
        $customerName = $requestData['customer_name'] ?? null;
        $customerPhone = $requestData['customer_phone'] ?? null;
        $customerAddress = $requestData['customer_address'] ?? null;
        $discountPercent = (float)($requestData['discount_percent'] ?? 0);
        $notes = $requestData['notes'] ?? null;
        $items = $requestData['items'] ?? [];
        $dueAmount = (float)($requestData['due_amount'] ?? 0);

        if ($dueAmount <= 0) {
            Auth::jsonError('Held bills must have a valid due amount.', 400);
        }

        try {
            DB::query(
                "INSERT INTO held_bills (shop_id, user_id, customer_id, customer_name, customer_phone, customer_address, discount_percent, notes, items, due_amount, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'held')",
                [
                    $shopId,
                    $userId,
                    $customerId ? (int)$customerId : null,
                    $customerName,
                    $customerPhone,
                    $customerAddress,
                    $discountPercent,
                    $notes,
                    json_encode($items),
                    $dueAmount
                ]
            );
            $billId = DB::lastInsertId();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Bill held successfully.',
                'held_bill_id' => (int)$billId
            ]);

        } catch (\Exception $e) {
            error_log('Create held bill error: ' . $e->getMessage());
            Auth::jsonError('Server error holding bill.', 500);
        }
    }

    public static function updateHeldBill($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant(true);
        Auth::authorize(['shop_admin', 'shop_staff']);

        $heldBillId = (int)$id;
        $shopId = Auth::$shopId;
        $status = $requestData['status'] ?? null;
        $notes = $requestData['notes'] ?? null;

        if (empty($status)) {
            Auth::jsonError('Status is required.', 400);
        }

        try {
            $stmt = DB::query('SELECT id FROM held_bills WHERE id = ? AND shop_id = ?', [$heldBillId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Held bill not found or access denied.', 404);
            }

            DB::query(
                'UPDATE held_bills SET status = ?, notes = COALESCE(?, notes) WHERE id = ? AND shop_id = ?',
                [$status, $notes, $heldBillId, $shopId]
            );

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Held bill updated successfully.']);

        } catch (\Exception $e) {
            error_log('Update held bill error: ' . $e->getMessage());
            Auth::jsonError('Server error updating held bill.', 500);
        }
    }

    public static function payHeldBillDue($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant(true);
        Auth::authorize(['shop_admin', 'shop_staff']);

        $heldBillId = (int)$id;
        $shopId = Auth::$shopId;
        $userId = Auth::$user['id'];
        $paymentAmount = (float)($requestData['payment_amount'] ?? 0);
        $paymentMethod = $requestData['payment_method'] ?? 'cash';

        if ($paymentAmount <= 0) {
            Auth::jsonError('Payment amount must be a positive number.', 400);
        }

        $validMethods = ['cash', 'card', 'mobile_pay', 'other'];
        if (!in_array($paymentMethod, $validMethods)) {
            Auth::jsonError('Invalid payment method.', 400);
        }

        try {
            DB::beginTransaction();

            // Lock bill row
            $stmt = DB::query('SELECT * FROM held_bills WHERE id = ? AND shop_id = ? FOR UPDATE', [$heldBillId, $shopId]);
            $bill = $stmt->fetch();

            if (!$bill) {
                DB::rollBack();
                Auth::jsonError('Held bill not found or access denied.', 404);
            }

            $currentDue = (float)$bill['due_amount'];

            if ($currentDue <= 0) {
                DB::rollBack();
                Auth::jsonError('This held bill has no outstanding due amount.', 400);
            }

            if (empty($bill['customer_id'])) {
                DB::rollBack();
                Auth::jsonError('No customer linked to this held bill. Cannot process due payment.', 400);
            }

            $actualPayment = min($paymentAmount, $currentDue);
            $newDue = (float)round($currentDue - $actualPayment, 2);

            // Update held bill
            $newStatus = $newDue <= 0 ? 'completed' : $bill['status'];
            DB::query(
                'UPDATE held_bills SET due_amount = ?, status = ? WHERE id = ? AND shop_id = ?',
                [$newDue, $newStatus, $heldBillId, $shopId]
            );

            // Reduce customer due balance
            DB::query(
                'UPDATE customers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
                [$actualPayment, (int)$bill['customer_id'], $shopId]
            );

            // Parse original sale ID from notes if linked
            $originalSaleId = null;
            if (!empty($bill['notes']) && strpos($bill['notes'], 'Due from Sale #') === 0) {
                if (preg_match('/Due from Sale #(\d+)/', $bill['notes'], $matches)) {
                    $originalSaleId = (int)$matches[1];
                }
            }

            if ($originalSaleId) {
                DB::query(
                    'UPDATE sales SET paid_amount = paid_amount + ?, due_amount = GREATEST(due_amount - ?, 0) WHERE id = ? AND shop_id = ?',
                    [$actualPayment, $actualPayment, $originalSaleId, $shopId]
                );
            }

            // Insert into due_payments
            DB::query(
                'INSERT INTO due_payments (shop_id, customer_id, sale_id, amount, payment_method) VALUES (?, ?, ?, ?, ?)',
                [$shopId, (int)$bill['customer_id'], $originalSaleId, $actualPayment, $paymentMethod]
            );

            // Record secondary sales transaction if not linked to original sale
            if (!$originalSaleId) {
                DB::query(
                    'INSERT INTO sales (shop_id, customer_id, user_id, total_amount, discount, tax, final_amount, paid_amount, due_amount, payment_method) 
                     VALUES (?, ?, ?, 0, 0, 0, 0, ?, 0, ?)',
                    [$shopId, (int)$bill['customer_id'], $userId, $actualPayment, $paymentMethod]
                );
            }

            DB::commit();

            // Fetch customer updated due balance
            $stmt = DB::query('SELECT due_balance FROM customers WHERE id = ? AND shop_id = ?', [(int)$bill['customer_id'], $shopId]);
            $custDue = (float)($stmt->fetchColumn() ?: 0);

            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'Due payment collected successfully.',
                'held_bill_id' => $heldBillId,
                'payment_collected' => $actualPayment,
                'remaining_due' => $newDue,
                'new_status' => $newStatus,
                'customer_due_balance' => $custDue
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Due payment error: ' . $e->getMessage());
            Auth::jsonError('Server error processing due payment.', 500);
        }
    }

    public static function deleteHeldBill($id) {
        Auth::authenticate();
        Auth::enforceTenant(true);
        Auth::authorize(['shop_admin', 'shop_staff']);

        $heldBillId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            $stmt = DB::query('SELECT id FROM held_bills WHERE id = ? AND shop_id = ?', [$heldBillId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Held bill not found or access denied.', 404);
            }

            DB::query('DELETE FROM held_bills WHERE id = ? AND shop_id = ?', [$heldBillId, $shopId]);

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Held bill deleted successfully.']);

        } catch (\Exception $e) {
            error_log('Delete held bill error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting held bill.', 500);
        }
    }
}
