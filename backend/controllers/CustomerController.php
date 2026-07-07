<?php
/**
 * Customer Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

class CustomerController {

    public static function listCustomers() {
        Auth::authenticate();
        Auth::enforceTenant();

        $shopId = Auth::$shopId;
        $hasShop = $shopId !== null;

        try {
            $sql = 'SELECT c.id, c.name, c.phone, c.email, c.address, c.due_balance, c.loyalty_points, sh.name AS shop_name 
                    FROM customers c 
                    LEFT JOIN shops sh ON c.shop_id = sh.id 
                    WHERE ' . ($hasShop ? 'c.shop_id = ?' : '1=1') . ' 
                    ORDER BY c.name ASC';
            $params = $hasShop ? [$shopId] : [];
            $stmt = DB::query($sql, $params);
            $customers = $stmt->fetchAll();

            foreach ($customers as &$c) {
                $c['id'] = (int)$c['id'];
                $c['due_balance'] = (float)$c['due_balance'];
                $c['loyalty_points'] = (int)$c['loyalty_points'];
            }

            header('Content-Type: application/json');
            echo json_encode($customers);

        } catch (\Exception $e) {
            error_log('Fetch customers error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving customer directory.', 500);
        }
    }

    public static function createCustomer($requestData) {
        Auth::authenticate();
        Auth::enforceTenant(true);
        Auth::authorize(['shop_admin', 'shop_staff']);

        $shopId = Auth::$shopId;
        $name = $requestData['name'] ?? '';
        $email = $requestData['email'] ?? null;
        $phone = $requestData['phone'] ?? null;
        $address = $requestData['address'] ?? null;

        if (empty($name)) {
            Auth::jsonError('Customer name is required.', 400);
        }

        try {
            DB::query(
                'INSERT INTO customers (shop_id, name, email, phone, address) VALUES (?, ?, ?, ?, ?)',
                [$shopId, $name, empty($email) ? null : $email, empty($phone) ? null : $phone, empty($address) ? null : $address]
            );
            $newCustomerId = DB::lastInsertId();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Customer profile created.',
                'id' => (int)$newCustomerId
            ]);

        } catch (\Exception $e) {
            error_log('Create customer error: ' . $e->getMessage());
            Auth::jsonError('Server error creating customer profile.', 500);
        }
    }

    public static function updateCustomer($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant(true);
        Auth::authorize(['shop_admin', 'shop_staff']);

        $customerId = (int)$id;
        $shopId = Auth::$shopId;
        $name = $requestData['name'] ?? '';
        $email = $requestData['email'] ?? null;
        $phone = $requestData['phone'] ?? null;
        $address = $requestData['address'] ?? null;

        if (empty($name)) {
            Auth::jsonError('Customer name is required.', 400);
        }

        try {
            // Check existence
            $stmt = DB::query('SELECT id FROM customers WHERE id = ? AND shop_id = ?', [$customerId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Customer not found or access denied.', 404);
            }

            DB::query(
                'UPDATE customers SET name = ?, email = ?, phone = ?, address = ? WHERE id = ? AND shop_id = ?',
                [$name, empty($email) ? null : $email, empty($phone) ? null : $phone, empty($address) ? null : $address, $customerId, $shopId]
            );

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Customer updated successfully.']);

        } catch (\Exception $e) {
            error_log('Update customer error: ' . $e->getMessage());
            Auth::jsonError('Server error updating customer profile.', 500);
        }
    }

    public static function deleteCustomer($id) {
        Auth::authenticate();
        Auth::enforceTenant(true);
        Auth::authorize(['shop_admin']);

        $customerId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            // Check existence
            $stmt = DB::query('SELECT id FROM customers WHERE id = ? AND shop_id = ?', [$customerId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Customer not found or access denied.', 404);
            }

            DB::query('DELETE FROM customers WHERE id = ? AND shop_id = ?', [$customerId, $shopId]);

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Customer profile deleted successfully.']);

        } catch (\PDOException $e) {
            error_log('Delete customer DB error: ' . $e->getMessage());
            if ($e->getCode() == 23000 || strpos($e->getMessage(), 'a foreign key constraint fails') !== false) {
                Auth::jsonError('Cannot delete customer. Buyer is referenced in active transaction records.', 400);
            }
            Auth::jsonError('Server error deleting customer.', 500);
        } catch (\Exception $e) {
            error_log('Delete customer error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting customer.', 500);
        }
    }

    public static function bulkUpload() {
        Auth::authenticate();
        Auth::enforceTenant(true);
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;

        if (empty($_FILES['csvFile']) || $_FILES['csvFile']['error'] !== UPLOAD_ERR_OK) {
            Auth::jsonError('No CSV file uploaded or file upload error.', 400);
        }

        $file = $_FILES['csvFile'];

        // Validate size (5MB limit)
        if ($file['size'] > 5 * 1024 * 1024) {
            Auth::jsonError('File size exceeds 5MB limit.', 400);
        }

        // Validate extension
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        if (strtolower($ext) !== 'csv') {
            Auth::jsonError('Only CSV files are allowed.', 400);
        }

        try {
            $handle = fopen($file['tmp_name'], 'r');
            if (!$handle) {
                Auth::jsonError('Failed to open uploaded file.', 500);
            }

            // Parse headers
            $headerLine = fgetcsv($handle);
            if (!$headerLine) {
                fclose($handle);
                Auth::jsonError('CSV file is empty or invalid.', 400);
            }

            // Clean BOM and lowercase/trim headers
            $headerLine[0] = preg_replace('/^\xEF\xBB\xBF/', '', $headerLine[0]);
            $headers = array_map(function($h) {
                return trim(strtolower($h));
            }, $headerLine);

            $validCustomers = [];
            $errors = [];
            $rowNumber = 2; // Header is row 1

            while (($row = fgetcsv($handle)) !== false) {
                // If row count matches header count
                if (count($row) !== count($headers)) {
                    $errors[] = "Row $rowNumber: Column count does not match header count.";
                    $rowNumber++;
                    continue;
                }

                $rowData = array_combine($headers, $row);
                $name = isset($rowData['name']) ? trim($rowData['name']) : '';
                $email = isset($rowData['email']) && trim($rowData['email']) !== '' ? trim($rowData['email']) : null;
                $phone = isset($rowData['phone']) && trim($rowData['phone']) !== '' ? trim($rowData['phone']) : null;
                $address = isset($rowData['address']) && trim($rowData['address']) !== '' ? trim($rowData['address']) : null;

                // Check empty row
                if (empty($name) && empty($email) && empty($phone) && empty($address)) {
                    $rowNumber++;
                    continue;
                }

                if (empty($name)) {
                    $errors[] = "Row $rowNumber: Customer name is required";
                    $rowNumber++;
                    continue;
                }

                $validCustomers[] = [
                    'name' => $name,
                    'email' => $email,
                    'phone' => $phone,
                    'address' => $address
                ];

                $rowNumber++;
            }
            fclose($handle);

            if (empty($validCustomers)) {
                header('Content-Type: application/json');
                http_response_code(400);
                echo json_encode([
                    'error' => 'No valid customers found in CSV.',
                    'errors' => $errors
                ]);
                exit;
            }

            // Bulk Insert
            $sql = 'INSERT INTO customers (shop_id, name, email, phone, address) VALUES ';
            $insertParts = [];
            $params = [];

            foreach ($validCustomers as $c) {
                $insertParts[] = '(?, ?, ?, ?, ?)';
                $params[] = $shopId;
                $params[] = $c['name'];
                $params[] = $c['email'];
                $params[] = $c['phone'];
                $params[] = $c['address'];
            }

            $sql .= implode(', ', $insertParts);
            DB::query($sql, $params);

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => "Successfully imported " . count($validCustomers) . " customers.",
                'imported' => count($validCustomers),
                'errors' => !empty($errors) ? $errors : null
            ]);

        } catch (\Exception $e) {
            error_log('Bulk upload customer error: ' . $e->getMessage());
            Auth::jsonError('Server error processing CSV upload.', 500);
        }
    }

    public static function exportCSV() {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;

        try {
            $stmt = DB::query(
                'SELECT id, name, phone, email, address, due_balance, loyalty_points, created_at FROM customers WHERE shop_id = ? ORDER BY name ASC',
                [$shopId]
            );
            $customers = $stmt->fetchAll();

            if (empty($customers)) {
                Auth::jsonError('No customers found to export.', 404);
            }

            $headers = ['ID', 'Name', 'Phone', 'Email', 'Address', 'Due Balance', 'Loyalty Points', 'Created At'];
            
            // Clean output buffer
            if (ob_get_level()) {
                ob_end_clean();
            }

            header('Content-Type: text/csv');
            header('Content-Disposition: attachment; filename="customers_export_' . date('Y-m-d') . '.csv"');
            header('Pragma: no-cache');
            header('Expires: 0');

            $output = fopen('php://output', 'w');
            
            // Add UTF-8 BOM for Excel support
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
            
            fputcsv($output, $headers);

            foreach ($customers as $c) {
                fputcsv($output, [
                    $c['id'],
                    $c['name'] ?: '',
                    $c['phone'] ?: '',
                    $c['email'] ?: '',
                    $c['address'] ?: '',
                    $c['due_balance'] ?: 0,
                    $c['loyalty_points'] ?: 0,
                    $c['created_at'] ?: ''
                ]);
            }
            fclose($output);
            exit;

        } catch (\Exception $e) {
            error_log('CSV export error: ' . $e->getMessage());
            Auth::jsonError('Server error exporting customers to CSV.', 500);
        }
    }

    public static function getCustomerHistory($id) {
        Auth::authenticate();
        Auth::enforceTenant();

        $customerId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            // Verify customer belongs to shop
            $stmt = DB::query('SELECT id FROM customers WHERE id = ? AND shop_id = ?', [$customerId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Customer not found or access denied.', 404);
            }

            // Fetch transaction history
            $sql = "SELECT 
                        s.id AS sale_id,
                        s.created_at,
                        s.payment_method,
                        s.total_amount,
                        s.discount,
                        s.tax,
                        s.final_amount,
                        s.paid_amount,
                        s.due_amount,
                        si.id AS item_id,
                        si.product_id,
                        si.quantity,
                        si.unit_price,
                        si.subtotal,
                        p.name AS product_name,
                        p.sku AS product_sku,
                        GREATEST(si.quantity - COALESCE(cr.returned_quantity, 0), 0) AS returnable_quantity
                    FROM sales s
                    LEFT JOIN sale_items si ON s.id = si.sale_id
                    LEFT JOIN products p ON si.product_id = p.id
                    LEFT JOIN (
                        SELECT sale_id, product_id, SUM(quantity) AS returned_quantity
                        FROM customer_returns
                        WHERE shop_id = ?
                        GROUP BY sale_id, product_id
                    ) cr ON s.id = cr.sale_id AND si.product_id = cr.product_id
                    WHERE s.customer_id = ? AND s.shop_id = ?
                    ORDER BY s.created_at DESC";

            $stmt = DB::query($sql, [$shopId, $customerId, $shopId]);
            $rows = $stmt->fetchAll();

            $salesMap = [];
            foreach ($rows as $row) {
                $saleId = $row['sale_id'];
                if (!isset($salesMap[$saleId])) {
                    $salesMap[$saleId] = [
                        'sale_id' => (int)$saleId,
                        'created_at' => $row['created_at'],
                        'payment_method' => $row['payment_method'],
                        'total_amount' => (float)$row['total_amount'],
                        'discount' => (float)$row['discount'],
                        'tax' => (float)$row['tax'],
                        'final_amount' => (float)$row['final_amount'],
                        'paid_amount' => (float)$row['paid_amount'],
                        'due_amount' => (float)$row['due_amount'],
                        'items' => []
                    ];
                }

                if ($row['item_id']) {
                    $salesMap[$saleId]['items'][] = [
                        'item_id' => (int)$row['item_id'],
                        'product_id' => (int)$row['product_id'],
                        'product_name' => $row['product_name'],
                        'product_sku' => $row['product_sku'],
                        'quantity' => (int)$row['quantity'],
                        'unit_price' => (float)$row['unit_price'],
                        'subtotal' => (float)$row['subtotal'],
                        'returnable_quantity' => (int)$row['returnable_quantity']
                    ];
                }
            }

            $salesList = array_values($salesMap);

            // Fetch due payments collections
            $stmt = DB::query(
                'SELECT id, created_at, payment_method, amount FROM due_payments WHERE customer_id = ? AND shop_id = ? ORDER BY created_at DESC',
                [$customerId, $shopId]
            );
            $payments = $stmt->fetchAll();

            foreach ($payments as $p) {
                $salesList[] = [
                    'sale_id' => 'pay-' . $p['id'],
                    'created_at' => $p['created_at'],
                    'payment_method' => $p['payment_method'],
                    'total_amount' => 0.0,
                    'discount' => 0.0,
                    'tax' => 0.0,
                    'final_amount' => (float)$p['amount'],
                    'paid_amount' => (float)$p['amount'],
                    'due_amount' => 0.0,
                    'items' => []
                ];
            }

            // Sort combined records by created_at DESC
            usort($salesList, function($a, $b) {
                return strcmp($b['created_at'], $a['created_at']);
            });

            header('Content-Type: application/json');
            echo json_encode($salesList);

        } catch (\Exception $e) {
            error_log('Fetch customer history error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving customer purchase history.', 500);
        }
    }
}
