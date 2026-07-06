<?php
/**
 * PHP Front Controller & Router for POS Backend (Fixed for Subfolder Hosting)
 */

// Handle dynamic CORS origin requirements for Allow-Credentials
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: " . $_SERVER['HTTP_ORIGIN']);
} else {
    header("Access-Control-Allow-Origin: *");
}
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Auth-Token");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Credentials: true");

// Handle OPTIONS requests (CORS preflight) immediately before running router logic
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Load Environment Variables
function loadEnv() {
    $paths = [
        __DIR__ . '/.env',
        dirname(__DIR__) . '/backend/.env',
        __DIR__ . '/.env.example'
    ];
    foreach ($paths as $path) {
        if (file_exists($path)) {
            $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line) || strpos($line, '#') === 0) continue;
                if (strpos($line, '=') !== false) {
                    list($name, $value) = explode('=', $line, 2);
                    $name = trim($name);
                    $value = trim($value);
                    if (preg_match('/^["\'](.*)["\']$/', $value, $matches)) {
                        $value = $matches[1];
                    }
                    putenv("$name=$value");
                    $_ENV[$name] = $value;
                }
            }
            break;
        }
    }
}
loadEnv();

// Include Controllers
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/ProductController.php';
require_once __DIR__ . '/controllers/CustomerController.php';
require_once __DIR__ . '/controllers/SupplierController.php';
require_once __DIR__ . '/controllers/SaleController.php';
require_once __DIR__ . '/controllers/AnalyticsController.php';
require_once __DIR__ . '/controllers/HeldBillController.php';
require_once __DIR__ . '/controllers/ManualOrderController.php';
require_once __DIR__ . '/controllers/OtherController.php';
require_once __DIR__ . '/controllers/OtherSalesController.php';

// Parse Request URI and Method
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = trim($requestUri, '/');

// FIX: Dynamic directory normalization. Strips 'backend/', 'api/', or 'index.php' matching your subfolder setup.
$prefixesToRemove = ['backend/api', 'backend', 'api'];
foreach ($prefixesToRemove as $prefix) {
    if (strpos($uri, $prefix . '/') === 0) {
        $uri = substr($uri, strlen($prefix) + 1);
        break;
    } else if ($uri === $prefix) {
        $uri = '';
        break;
    }
}

// Remove trailing index.php references if hit directly
if (strpos($uri, 'index.php/') === 0) {
    $uri = substr($uri, 10);
} else if ($uri === 'index.php') {
    $uri = '';
}

$method = $_SERVER['REQUEST_METHOD'];

// Parse Request Body (JSON)
$requestData = [];
if ($method === 'POST' || $method === 'PUT') {
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        $decoded = json_decode($rawInput, true);
        if (is_array($decoded)) {
            $requestData = $decoded;
        }
    }
}

// Global Exception Handler
set_exception_handler(function($e) {
    error_log("Unhandled Exception: " . $e->getMessage() . " in " . $e->getFile() . " on line " . $e->getLine());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Something went wrong on the server: ' . $e->getMessage()]);
    exit;
});

// Routing Table
$routes = [
    'GET' => [
        // Root / Welcome
        '/^$/' => function() {
            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'Multi-Tenant POS PHP Backend is running',
                'status' => 'healthy',
                'timestamp' => date('c')
            ]);
        },
        // Health
        '/^health$/' => function() {
            header('Content-Type: application/json');
            echo json_encode(['status' => 'healthy', 'timestamp' => date('c')]);
        },
        // Diagnostics
        '/^diagnostic$/' => function() {
            header('Content-Type: text/plain');
            try {
                $pdo = DB::getConnection();
                echo "==================================================\n";
                echo "DATABASE DIAGNOSTICS FOR LIVE/LOCAL CONFIGURATION\n";
                echo "==================================================\n\n";

                // 1. Check Shops
                echo "--- Shops in Database ---\n";
                $stmt = $pdo->query("SELECT id, name, status FROM shops");
                $shops = $stmt->fetchAll(PDO::FETCH_ASSOC);
                if (empty($shops)) {
                    echo "No shops found in the database.\n";
                } else {
                    foreach ($shops as $shop) {
                        echo "Shop ID: {$shop['id']} | Name: {$shop['name']} | Status: {$shop['status']}\n";
                    }
                }
                echo "\n";

                // 2. Check Users
                echo "--- Users in Database ---\n";
                $stmt = $pdo->query("SELECT id, shop_id, name, email, role, status FROM users");
                $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
                if (empty($users)) {
                    echo "No users found in the database.\n";
                } else {
                    foreach ($users as $user) {
                        $shop_id = $user['shop_id'] !== null ? $user['shop_id'] : 'NULL (Super Admin)';
                        echo "User ID: {$user['id']} | Email: {$user['email']} | Role: {$user['role']} | Shop ID: $shop_id | Status: {$user['status']}\n";
                    }
                }
                echo "\n";

                // 3. Count products by shop_id
                echo "--- Data Counts grouped by shop_id ---\n";
                $tables = ['products', 'customers', 'sales', 'suppliers', 'purchase_orders', 'other_costs', 'wastages', 'held_bills', 'manual_orders'];
                
                foreach ($tables as $table) {
                    try {
                        $stmt = $pdo->query("SELECT shop_id, COUNT(*) as count FROM `$table` GROUP BY shop_id");
                        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        echo "Table `$table`:\n";
                        if (empty($results)) {
                            echo "  No data found.\n";
                        } else {
                            foreach ($results as $res) {
                                echo "  Shop ID: {$res['shop_id']} -> Count: {$res['count']}\n";
                            }
                        }
                    } catch (\Exception $ex) {
                        echo "Table `$table` failed to query: " . $ex->getMessage() . "\n";
                    }
                }
                echo "\n";

                // 4. Products Table Columns Inspection
                echo "--- Products Table Columns ---\n";
                try {
                    $stmt = $pdo->query("DESCRIBE products");
                    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($columns as $col) {
                        echo "Field: {$col['Field']} | Type: {$col['Type']} | Null: {$col['Null']} | Default: {$col['Default']}\n";
                    }
                } catch (\Exception $e) {
                    echo "Failed to describe products: " . $e->getMessage() . "\n";
                }
                echo "\n";

                // 5. Simulate listProducts Query
                echo "--- Simulating products query for Shop ID 2 ---\n";
                try {
                    $sql = "SELECT p.*, s.name AS supplier_name, sh.name AS shop_name
                            FROM products p
                            LEFT JOIN suppliers s ON p.supplier_id = s.id
                            LEFT JOIN shops sh ON p.shop_id = sh.id
                            WHERE p.shop_id = ?";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute([2]);
                    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    echo "Query succeeded! Returned " . count($results) . " products.\n";
                } catch (\Exception $e) {
                    echo "QUERY FAILED: " . $e->getMessage() . "\n";
                }
                
                echo "\n==================================================\n";

            } catch (\Exception $e) {
                echo "CRITICAL: Database connection failed: " . $e->getMessage() . "\n";
            }
            exit;
        },
        // Auth
        '/^auth\/me$/' => function() { AuthController::getMe(); },
        // Products
        '/^products$/' => function() { ProductController::listProducts(); },
        '/^products\/(\d+)\/stock-sales-history$/' => function($args) { ProductController::getProductStockSalesHistory($args[0]); },
        '/^products\/(\d+)$/' => function($args) { ProductController::getProduct($args[0]); },
        // Customers
        '/^customers$/' => function() { CustomerController::listCustomers(); },
        '/^customers\/export\/csv$/' => function() { CustomerController::exportCSV(); },
        '/^customers\/(\d+)\/history$/' => function($args) { CustomerController::getCustomerHistory($args[0]); },
        // Suppliers
        '/^suppliers$/' => function() { SupplierController::listSuppliers(); },
        '/^suppliers\/purchase-orders$/' => function() { SupplierController::listPurchaseOrders(); },
        '/^suppliers\/cost-price-logs$/' => function() { SupplierController::listCostPriceLogs(); },
        '/^suppliers\/cost-price-logs\/export\/csv$/' => function() { SupplierController::exportCostPriceLogsCSV(); },
        '/^suppliers\/purchase-orders\/export\/csv$/' => function() { SupplierController::exportPurchaseOrdersCSV(); },
        '/^suppliers\/purchase-orders\/(\d+)$/' => function($args) { SupplierController::getPurchaseOrder($args[0]); },
        '/^suppliers\/(\d+)\/profile$/' => function($args) { SupplierController::getSupplierProfile($args[0]); },
        // Sales
        '/^sales$/' => function() { SaleController::listSales(); },
        '/^sales\/(\d+)$/' => function($args) { SaleController::getSale($args[0]); },
        // Analytics
        '/^analytics\/revenue$/' => function() { AnalyticsController::getRevenueBreakdown(); },
        '/^analytics$/' => function() { AnalyticsController::getDashboardData(); },
        '/^analytics\/daily-products$/' => function() { AnalyticsController::getDailyProductSales(); },
        // Held Bills
        '/^held-bills$/' => function() { HeldBillController::listHeldBills(); },
        // Manual Orders
        '/^manual-orders$/' => function() { ManualOrderController::listManualOrders(); },
        '/^manual-orders\/(\d+)$/' => function($args) { ManualOrderController::getManualOrder($args[0]); },
        // Other Costs
        '/^other-costs$/' => function() { OtherController::listOtherCosts(); },
        // Other Sales
        '/^other-sales$/' => function() { OtherSalesController::listOtherSales(); },
        // Wastages
        '/^wastages$/' => function() { OtherController::listWastages(); },
        // Returns
        '/^returns$/' => function() { OtherController::listReturns(); },
        // Adjustments
        '/^adjustments$/' => function() { OtherController::listAdjustments(); },
        // Shops
        '/^shops$/' => function() { OtherController::listShops(); },
        '/^shops\/my-shop$/' => function() { OtherController::getMyShop(); },
        '/^shops\/(\d+)\/users$/' => function($args) { OtherController::listShopUsers($args[0]); },
        // Users
        '/^users$/' => function() { OtherController::listUsers(); },
        '/^users\/staff$/' => function() { OtherController::listStaff(); },
    ],
    'POST' => [
        // Auth
        '/^auth\/login$/' => function($args, $data) { AuthController::login($data); },
        '/^auth\/register-shop$/' => function($args, $data) { AuthController::registerShop($data); },
        // Products
        '/^products$/' => function($args, $data) { ProductController::createProduct($data); },
        '/^products\/bulk-upload$/' => function($args, $data) { ProductController::bulkUploadProducts(); },
        // Customers
        '/^customers$/' => function($args, $data) { CustomerController::createCustomer($data); },
        '/^customers\/bulk-upload$/' => function($args, $data) { CustomerController::bulkUpload(); },
        // Suppliers
        '/^suppliers$/' => function($args, $data) { SupplierController::createSupplier($data); },
        '/^suppliers\/purchase-orders$/' => function($args, $data) { SupplierController::createPurchaseOrder($data); },
        '/^suppliers\/(\d+)\/returns$/' => function($args, $data) { SupplierController::createSupplierReturn($args[0], $data); },
        // Sales
        '/^sales$/' => function($args, $data) { SaleController::createSale($data); },
        '/^sales\/bulk-delete$/' => function($args, $data) { SaleController::bulkDeleteSales($data); },
        // Held Bills
        '/^held-bills$/' => function($args, $data) { HeldBillController::createHeldBill($data); },
        '/^held-bills\/(\d+)\/pay-due$/' => function($args, $data) { HeldBillController::payHeldBillDue($args[0], $data); },
        // Manual Orders
        '/^manual-orders$/' => function($args, $data) { ManualOrderController::createManualOrder($data); },
        '/^manual-orders\/(\d+)\/confirm$/' => function($args, $data) { ManualOrderController::confirmManualOrder($args[0]); },
        '/^manual-orders\/sales\/(\d+)\/pay-due$/' => function($args, $data) { ManualOrderController::payManualOrderSaleDue($args[0], $data); },
        // Other Costs
        '/^other-costs$/' => function($args, $data) { OtherController::createOtherCost($data); },
        // Other Sales
        '/^other-sales$/' => function($args, $data) { OtherSalesController::createOtherSale($data); },
        // Wastages
        '/^wastages$/' => function($args, $data) { OtherController::createWastage($data); },
        // Returns
        '/^returns$/' => function($args, $data) { OtherController::createReturn($data); },
        // Adjustments
        '/^adjustments$/' => function($args, $data) { OtherController::createAdjustment($data); },
        // Users
        '/^users$/' => function($args, $data) { OtherController::createUser($data); },
        '/^users\/staff$/' => function($args, $data) { OtherController::createStaff($data); },
    ],
    'PUT' => [
        // Auth
        '/^auth\/me$/' => function($args, $data) { AuthController::updateMe($data); },
        // Products
        '/^products\/(\d+)$/' => function($args, $data) { ProductController::updateProduct($args[0], $data); },
        // Customers
        '/^customers\/(\d+)$/' => function($args, $data) { CustomerController::updateCustomer($args[0], $data); },
        // Suppliers
        '/^suppliers\/purchase-orders\/(\d+)$/' => function($args, $data) { SupplierController::updatePurchaseOrder($args[0], $data); },
        '/^suppliers\/purchase-orders\/(\d+)\/status$/' => function($args, $data) { SupplierController::updatePurchaseOrderStatus($args[0], $data); },
        '/^suppliers\/purchase-orders\/(\d+)\/pay$/' => function($args, $data) { SupplierController::payPurchaseOrder($args[0], $data); },
        '/^suppliers\/returns\/(\d+)$/' => function($args, $data) { SupplierController::updateSupplierReturn($args[0], $data); },
        '/^suppliers\/(\d+)$/' => function($args, $data) { SupplierController::updateSupplier($args[0], $data); },
        // Held Bills
        '/^held-bills\/(\d+)$/' => function($args, $data) { HeldBillController::updateHeldBill($args[0], $data); },
        // Manual Orders
        '/^manual-orders\/(\d+)$/' => function($args, $data) { ManualOrderController::updateManualOrder($args[0], $data); },
        // Other Costs
        '/^other-costs\/(\d+)$/' => function($args, $data) { OtherController::updateOtherCost($args[0], $data); },
        // Other Sales
        '/^other-sales\/(\d+)$/' => function($args, $data) { OtherSalesController::updateOtherSale($args[0], $data); },
        // Shops
        '/^shops\/my-shop$/' => function($args, $data) { OtherController::updateMyShop($data); },
        '/^shops\/(\d+)\/status$/' => function($args, $data) { OtherController::updateShopStatus($args[0], $data); },
        '/^shops\/(\d+)$/' => function($args, $data) { OtherController::updateShop($args[0], $data); },
        '/^shops\/(\d+)\/users\/(\d+)\/reset-password$/' => function($args, $data) { OtherController::resetShopUserPassword($args[0], $args[1], $data); },
        '/^shops\/(\d+)\/users\/(\d+)\/status$/' => function($args, $data) { OtherController::updateShopUserStatus($args[0], $args[1], $data); },
        // Users
        '/^users\/(\d+)$/' => function($args, $data) { OtherController::updateUser($args[0], $data); },
        '/^users\/staff\/(\d+)$/' => function($args, $data) { OtherController::updateStaff($args[0], $data); },
    ],
    'DELETE' => [
        // Products
        '/^products\/(\d+)$/' => function($args) { ProductController::deleteProduct($args[0]); },
        // Customers
        '/^customers\/(\d+)$/' => function($args) { CustomerController::deleteCustomer($args[0]); },
        // Suppliers
        '/^suppliers\/purchase-orders\/(\d+)$/' => function($args) { SupplierController::deletePurchaseOrder($args[0]); },
        '/^suppliers\/purchase-orders\/(\d+)\/items\/(\d+)$/' => function($args) { SupplierController::deletePurchaseOrderItem($args[0], $args[1]); },
        '/^suppliers\/returns\/(\d+)$/' => function($args) { SupplierController::deleteSupplierReturn($args[0]); },
        '/^suppliers\/(\d+)$/' => function($args) { SupplierController::deleteSupplier($args[0]); },
        // Sales
        '/^sales\/(\d+)$/' => function($args) { SaleController::deleteSale($args[0]); },
        // Held Bills
        '/^held-bills\/(\d+)$/' => function($args) { HeldBillController::deleteHeldBill($args[0]); },
        // Manual Orders
        '/^manual-orders\/(\d+)$/' => function($args) { ManualOrderController::deleteManualOrder($args[0]); },
        // Other Costs
        '/^other-costs\/(\d+)$/' => function($args) { OtherController::deleteOtherCost($args[0]); },
        // Other Sales
        '/^other-sales\/(\d+)$/' => function($args) { OtherSalesController::deleteOtherSale($args[0]); },
        // Wastages
        '/^wastages\/(\d+)$/' => function($args) { OtherController::deleteWastage($args[0]); },
        // Returns
        '/^returns\/(\d+)$/' => function($args) { OtherController::deleteReturn($args[0]); },
        // Shops
        '/^shops\/(\d+)$/' => function($args) { OtherController::deleteShop($args[0]); },
        // Users
        '/^users\/(\d+)$/' => function($args) { OtherController::deleteUser($args[0]); },
        '/^users\/staff\/(\d+)$/' => function($args) { OtherController::deleteStaff($args[0]); },
    ]
];

// Match Route
if (isset($routes[$method])) {
    foreach ($routes[$method] as $pattern => $handler) {
        if (preg_match($pattern, $uri, $matches)) {
            // Shift off the full match
            array_shift($matches);
            // Execute handler
            $handler($matches, $requestData);
            exit;
        }
    }
}

// 404 Route Not Found
http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['error' => "Route $method /$uri not found on PHP backend."]);