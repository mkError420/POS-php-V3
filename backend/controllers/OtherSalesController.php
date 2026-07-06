<?php
/**
 * Other Sales Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

class OtherSalesController {

    public static function listOtherSales() {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['super_admin', 'shop_admin']);

        $shopId = Auth::$shopId;
        $hasShop = $shopId !== null;

        $startDate = $_GET['start_date'] ?? null;
        $endDate = $_GET['end_date'] ?? null;

        try {
            $sql = 'SELECT o.*, s.name AS shop_name 
                    FROM other_sales o 
                    LEFT JOIN shops s ON o.shop_id = s.id 
                    WHERE ' . ($hasShop ? 'o.shop_id = ?' : '1=1');
            $params = $hasShop ? [$shopId] : [];

            if (!empty($startDate) && !empty($endDate)) {
                $sql .= ' AND o.sale_date BETWEEN ? AND ?';
                $params[] = $startDate;
                $params[] = $endDate;
            }

            $sql .= ' ORDER BY o.sale_date DESC';

            $stmt = DB::query($sql, $params);
            $sales = $stmt->fetchAll();

            foreach ($sales as &$s) {
                $s['id'] = (int)$s['id'];
                $s['shop_id'] = (int)$s['shop_id'];
                $s['amount'] = (float)$s['amount'];
                $s['shop_name'] = $s['shop_name'] ?: 'System / Unknown';
            }

            header('Content-Type: application/json');
            echo json_encode($sales);

        } catch (\Exception $e) {
            error_log('Fetch other sales error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving sale list.', 500);
        }
    }

    public static function createOtherSale($requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;
        
        $customerName = $requestData['customer_name'] ?? null;
        $customerPhone = $requestData['customer_phone'] ?? null;
        $saleDate = $requestData['sale_date'] ?? null;
        $notes = $requestData['notes'] ?? null;
        $items = $requestData['items'] ?? [];

        if (empty($saleDate) || empty($items) || !is_array($items)) {
            Auth::jsonError('Please provide sale date and at least one item.', 400);
        }

        // Calculate total amount
        $amount = 0;
        foreach ($items as &$item) {
            $qty = isset($item['quantity']) ? (int)$item['quantity'] : 1;
            $price = isset($item['unit_price']) ? (float)$item['unit_price'] : 0;
            $subtotal = $qty * $price;
            $item['subtotal'] = $subtotal; // ensure subtotal is correctly calculated on backend
            $amount += $subtotal;
        }

        $itemsJson = json_encode($items);
        // Use first item name as title if needed, or generic
        $title = "Sale of " . count($items) . " items";
        if (count($items) == 1 && !empty($items[0]['item_name'])) {
            $title = "Sale: " . $items[0]['item_name'];
        }

        try {
            DB::query(
                'INSERT INTO other_sales (shop_id, title, customer_name, customer_phone, items, amount, sale_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [$shopId, $title, $customerName, $customerPhone, $itemsJson, $amount, $saleDate, $notes]
            );
            $newId = DB::lastInsertId();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Sale entry added successfully.',
                'saleId' => (int)$newId
            ]);

        } catch (\Exception $e) {
            error_log('Create other sale error: ' . $e->getMessage());
            Auth::jsonError('Server error recording sale entry.', 500);
        }
    }

    // We can disable update for complex line items or allow it.
    // For now, let's just allow it with full replacement of items.
    public static function updateOtherSale($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $saleId = (int)$id;
        $shopId = Auth::$shopId;

        $customerName = $requestData['customer_name'] ?? null;
        $customerPhone = $requestData['customer_phone'] ?? null;
        $saleDate = $requestData['sale_date'] ?? null;
        $notes = $requestData['notes'] ?? null;
        $items = $requestData['items'] ?? [];

        if (empty($saleDate) || empty($items) || !is_array($items)) {
            Auth::jsonError('Please provide sale date and at least one item.', 400);
        }

        $amount = 0;
        foreach ($items as &$item) {
            $qty = isset($item['quantity']) ? (int)$item['quantity'] : 1;
            $price = isset($item['unit_price']) ? (float)$item['unit_price'] : 0;
            $subtotal = $qty * $price;
            $item['subtotal'] = $subtotal;
            $amount += $subtotal;
        }

        $itemsJson = json_encode($items);
        $title = "Sale of " . count($items) . " items";
        if (count($items) == 1 && !empty($items[0]['item_name'])) {
            $title = "Sale: " . $items[0]['item_name'];
        }

        try {
            $stmt = DB::query('SELECT id FROM other_sales WHERE id = ? AND shop_id = ?', [$saleId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Sale record not found or access denied.', 404);
            }

            DB::query(
                'UPDATE other_sales SET title = ?, customer_name = ?, customer_phone = ?, items = ?, amount = ?, sale_date = ?, notes = ? WHERE id = ? AND shop_id = ?',
                [$title, $customerName, $customerPhone, $itemsJson, $amount, $saleDate, $notes, $saleId, $shopId]
            );

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Sale entry updated successfully.']);

        } catch (\Exception $e) {
            error_log('Update other sale error: ' . $e->getMessage());
            Auth::jsonError('Server error updating sale entry.', 500);
        }
    }

    public static function deleteOtherSale($id) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $saleId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            $stmt = DB::query('SELECT id FROM other_sales WHERE id = ? AND shop_id = ?', [$saleId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Sale record not found or access denied.', 404);
            }

            DB::query('DELETE FROM other_sales WHERE id = ? AND shop_id = ?', [$saleId, $shopId]);

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Sale entry deleted successfully.']);

        } catch (\Exception $e) {
            error_log('Delete other sale error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting sale entry.', 500);
        }
    }
}
