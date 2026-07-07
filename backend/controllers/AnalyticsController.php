<?php
/**
 * Analytics Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

class AnalyticsController {

    public static function getRevenueBreakdown() {
        Auth::authenticate();
        Auth::authorize(['super_admin', 'shop_admin']);

        $shopId = Auth::$shopId;
        $hasShop = $shopId !== null;
        $startDate = $_GET['start_date'] ?? null;
        $endDate = $_GET['end_date'] ?? null;

        try {
            // 1. Calculate Sales Revenue
            $salesSql = 'SELECT SUM(final_amount) AS total_sales, SUM(paid_amount) AS total_paid, COUNT(id) AS sales_count FROM sales WHERE ' . ($hasShop ? 'shop_id = ?' : 'shop_id IS NOT NULL');
            $salesParams = $hasShop ? [$shopId] : [];
            if (!empty($startDate) && !empty($endDate)) {
                $salesSql .= ' AND created_at BETWEEN ? AND ?';
                $salesParams[] = "$startDate 00:00:00";
                $salesParams[] = "$endDate 23:59:59";
            }
            $stmt = DB::query($salesSql, $salesParams);
            $salesRow = $stmt->fetch();
            $totalSales = (float)($salesRow['total_sales'] ?? 0);
            $totalSalesCash = (float)($salesRow['total_paid'] ?? 0);
            $salesCount = (int)($salesRow['sales_count'] ?? 0);

            // 2. COGS (Cost of Goods Sold)
            $cogsSql = 'SELECT SUM(si.quantity * p.cost_price) AS cogs 
                        FROM sale_items si 
                        JOIN products p ON si.product_id = p.id
                        JOIN sales s ON si.sale_id = s.id
                        WHERE ' . ($hasShop ? 'si.shop_id = ?' : 'si.shop_id IS NOT NULL');
            $cogsParams = $hasShop ? [$shopId] : [];
            if (!empty($startDate) && !empty($endDate)) {
                $cogsSql .= ' AND s.created_at BETWEEN ? AND ?';
                $cogsParams[] = "$startDate 00:00:00";
                $cogsParams[] = "$endDate 23:59:59";
            }
            $stmt = DB::query($cogsSql, $cogsParams);
            $totalCOGS = (float)($stmt->fetchColumn() ?: 0);

            // 3. Purchasing Costs
            $poSql = "SELECT SUM(total_amount) AS total_purchased, SUM(paid_amount) AS total_paid 
                      FROM purchase_orders 
                      WHERE " . ($hasShop ? "shop_id = ?" : "shop_id IS NOT NULL") . " AND status IN ('ordered', 'received')";
            $poParams = $hasShop ? [$shopId] : [];
            if (!empty($startDate) && !empty($endDate)) {
                $poSql .= ' AND (received_date BETWEEN ? AND ? OR (received_date IS NULL AND order_date BETWEEN ? AND ?))';
                $poParams[] = "$startDate 00:00:00";
                $poParams[] = "$endDate 23:59:59";
                $poParams[] = "$startDate 00:00:00";
                $poParams[] = "$endDate 23:59:59";
            }
            $stmt = DB::query($poSql, $poParams);
            $poRow = $stmt->fetch();
            $totalPurchasing = (float)($poRow['total_purchased'] ?? 0);
            $totalPurchasingCash = (float)($poRow['total_paid'] ?? 0);

            // 4. Other Costs
            $otherSql = 'SELECT SUM(amount) AS total_other_costs FROM other_costs WHERE ' . ($hasShop ? 'shop_id = ?' : 'shop_id IS NOT NULL');
            $otherParams = $hasShop ? [$shopId] : [];
            if (!empty($startDate) && !empty($endDate)) {
                $otherSql .= ' AND cost_date BETWEEN ? AND ?';
                $otherParams[] = $startDate;
                $otherParams[] = $endDate;
            }
            $stmt = DB::query($otherSql, $otherParams);
            $totalOther = (float)($stmt->fetchColumn() ?: 0);

            // 5. Wastage Loss
            $wastageSql = 'SELECT SUM(cost_loss) AS total_wastage FROM wastages WHERE ' . ($hasShop ? 'shop_id = ?' : 'shop_id IS NOT NULL');
            $wastageParams = $hasShop ? [$shopId] : [];
            if (!empty($startDate) && !empty($endDate)) {
                $wastageSql .= ' AND adjusted_at BETWEEN ? AND ?';
                $wastageParams[] = $startDate;
                $wastageParams[] = $endDate;
            }
            $stmt = DB::query($wastageSql, $wastageParams);
            $totalWastage = (float)($stmt->fetchColumn() ?: 0);

            // 6. Supplier Due Balance
            $supplierDueSql = 'SELECT SUM(due_balance) AS total_due FROM suppliers WHERE ' . ($hasShop ? 'shop_id = ?' : 'shop_id IS NOT NULL');
            $stmt = DB::query($supplierDueSql, $hasShop ? [$shopId] : []);
            $totalSupplierDue = (float)($stmt->fetchColumn() ?: 0);

            // 7. Customer Due Balance
            $customerDueSql = 'SELECT SUM(due_balance) AS total_due FROM customers WHERE ' . ($hasShop ? 'shop_id = ?' : 'shop_id IS NOT NULL');
            $stmt = DB::query($customerDueSql, $hasShop ? [$shopId] : []);
            $totalCustomerDue = (float)($stmt->fetchColumn() ?: 0);

            // 8. Customer Returns (Refunds)
            $returnsSql = 'SELECT SUM(refund_amount) AS total_refunds FROM customer_returns WHERE ' . ($hasShop ? 'shop_id = ?' : 'shop_id IS NOT NULL');
            $returnsParams = $hasShop ? [$shopId] : [];
            if (!empty($startDate) && !empty($endDate)) {
                $returnsSql .= ' AND created_at BETWEEN ? AND ?';
                $returnsParams[] = "$startDate 00:00:00";
                $returnsParams[] = "$endDate 23:59:59";
            }
            $stmt = DB::query($returnsSql, $returnsParams);
            $totalRefunds = (float)($stmt->fetchColumn() ?: 0);

            // 9. Returned COGS
            $returnedCogsSql = 'SELECT SUM(cr.quantity * p.cost_price) AS returned_cogs 
                                FROM customer_returns cr 
                                JOIN products p ON cr.product_id = p.id
                                WHERE ' . ($hasShop ? 'cr.shop_id = ?' : 'cr.shop_id IS NOT NULL');
            $returnedCogsParams = $hasShop ? [$shopId] : [];
            if (!empty($startDate) && !empty($endDate)) {
                $returnedCogsSql .= ' AND cr.created_at BETWEEN ? AND ?';
                $returnedCogsParams[] = "$startDate 00:00:00";
                $returnedCogsParams[] = "$endDate 23:59:59";
            }
            $stmt = DB::query($returnedCogsSql, $returnedCogsParams);
            $totalReturnedCOGS = (float)($stmt->fetchColumn() ?: 0);

            // 10. Other Sales (Miscellaneous/Scrap)
            $otherSalesSql = 'SELECT SUM(amount) AS total_other_sales FROM other_sales WHERE ' . ($hasShop ? 'shop_id = ?' : 'shop_id IS NOT NULL');
            $otherSalesParams = $hasShop ? [$shopId] : [];
            if (!empty($startDate) && !empty($endDate)) {
                $otherSalesSql .= ' AND sale_date BETWEEN ? AND ?';
                $otherSalesParams[] = $startDate;
                $otherSalesParams[] = $endDate;
            }
            $stmt = DB::query($otherSalesSql, $otherSalesParams);
            $totalOtherSales = (float)($stmt->fetchColumn() ?: 0);

            // Calculate net profits
            $netProfitCOGS = $totalSales + $totalOtherSales - ($totalCOGS - $totalReturnedCOGS) - $totalOther - $totalWastage - $totalRefunds;
            $netProfitCashflow = $totalSalesCash + $totalOtherSales - $totalPurchasingCash - $totalOther - $totalWastage - $totalRefunds;

            // Generate 7-Day Trend Map
            $trendMap = [];
            for ($i = 6; $i >= 0; $i--) {
                $dateStr = date('Y-m-d', strtotime("-$i days"));
                $trendMap[$dateStr] = [
                    'date' => $dateStr,
                    'sales_revenue' => 0.0,
                    'sales_cash_received' => 0.0,
                    'other_sales_revenue' => 0.0,
                    'cost_of_goods_sold' => 0.0,
                    'customer_returns' => 0.0,
                    'returned_cogs' => 0.0,
                    'other_costs' => 0.0,
                    'wastage_loss' => 0.0,
                    'inventory_purchasing_cost' => 0.0,
                    'inventory_purchasing_cash_paid' => 0.0,
                    'net_profit_cogs' => 0.0,
                    'net_profit_cashflow' => 0.0
                ];
            }

            // Fetch daily sales trend
            $trendSalesSql = 'SELECT DATE_FORMAT(created_at, "%Y-%m-%d") AS date, SUM(final_amount) AS revenue, SUM(paid_amount) AS cash_received 
                              FROM sales WHERE ' . ($hasShop ? 'shop_id = ?' : 'shop_id IS NOT NULL') . ' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) 
                              GROUP BY DATE_FORMAT(created_at, "%Y-%m-%d")';
            $stmt = DB::query($trendSalesSql, $hasShop ? [$shopId] : []);
            while ($row = $stmt->fetch()) {
                $dt = $row['date'];
                if (isset($trendMap[$dt])) {
                    $trendMap[$dt]['sales_revenue'] = (float)$row['revenue'];
                    $trendMap[$dt]['sales_cash_received'] = (float)$row['cash_received'];
                }
            }

            // Fetch daily COGS trend
            $trendCogsSql = 'SELECT DATE_FORMAT(s.created_at, "%Y-%m-%d") AS date, SUM(si.quantity * p.cost_price) AS cogs 
                             FROM sale_items si 
                             JOIN products p ON si.product_id = p.id
                             JOIN sales s ON si.sale_id = s.id
                             WHERE ' . ($hasShop ? 'si.shop_id = ?' : 'si.shop_id IS NOT NULL') . ' AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                             GROUP BY DATE_FORMAT(s.created_at, "%Y-%m-%d")';
            $stmt = DB::query($trendCogsSql, $hasShop ? [$shopId] : []);
            while ($row = $stmt->fetch()) {
                $dt = $row['date'];
                if (isset($trendMap[$dt])) {
                    $trendMap[$dt]['cost_of_goods_sold'] = (float)$row['cogs'];
                }
            }

            // Fetch daily returns trend
            $trendReturnsSql = 'SELECT DATE_FORMAT(created_at, "%Y-%m-%d") AS date, SUM(refund_amount) AS refunds 
                                FROM customer_returns WHERE ' . ($hasShop ? 'shop_id = ?' : 'shop_id IS NOT NULL') . ' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) 
                                GROUP BY DATE_FORMAT(created_at, "%Y-%m-%d")';
            $stmt = DB::query($trendReturnsSql, $hasShop ? [$shopId] : []);
            while ($row = $stmt->fetch()) {
                $dt = $row['date'];
                if (isset($trendMap[$dt])) {
                    $trendMap[$dt]['customer_returns'] = (float)$row['refunds'];
                }
            }

            // Fetch daily returned COGS trend
            $trendReturnedCogsSql = 'SELECT DATE_FORMAT(cr.created_at, "%Y-%m-%d") AS date, SUM(cr.quantity * p.cost_price) AS returned_cogs 
                                     FROM customer_returns cr 
                                     JOIN products p ON cr.product_id = p.id
                                     WHERE ' . ($hasShop ? 'cr.shop_id = ?' : 'cr.shop_id IS NOT NULL') . ' AND cr.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                                     GROUP BY DATE_FORMAT(cr.created_at, "%Y-%m-%d")';
            $stmt = DB::query($trendReturnedCogsSql, $hasShop ? [$shopId] : []);
            while ($row = $stmt->fetch()) {
                $dt = $row['date'];
                if (isset($trendMap[$dt])) {
                    $trendMap[$dt]['returned_cogs'] = (float)$row['returned_cogs'];
                }
            }

            // Fetch daily other costs trend
            $trendOtherSql = 'SELECT DATE_FORMAT(cost_date, "%Y-%m-%d") AS date, SUM(amount) AS other 
                              FROM other_costs WHERE ' . ($hasShop ? 'shop_id = ?' : 'shop_id IS NOT NULL') . ' AND cost_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) 
                              GROUP BY DATE_FORMAT(cost_date, "%Y-%m-%d")';
            $stmt = DB::query($trendOtherSql, $hasShop ? [$shopId] : []);
            while ($row = $stmt->fetch()) {
                $dt = $row['date'];
                if (isset($trendMap[$dt])) {
                    $trendMap[$dt]['other_costs'] = (float)$row['other'];
                }
            }

            // Fetch daily wastages trend
            $trendWastageSql = 'SELECT DATE_FORMAT(adjusted_at, "%Y-%m-%d") AS date, SUM(cost_loss) AS wastage 
                                FROM wastages WHERE ' . ($hasShop ? 'shop_id = ?' : 'shop_id IS NOT NULL') . ' AND adjusted_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) 
                                GROUP BY DATE_FORMAT(adjusted_at, "%Y-%m-%d")';
            $stmt = DB::query($trendWastageSql, $hasShop ? [$shopId] : []);
            while ($row = $stmt->fetch()) {
                $dt = $row['date'];
                if (isset($trendMap[$dt])) {
                    $trendMap[$dt]['wastage_loss'] = (float)$row['wastage'];
                }
            }

            // Fetch daily PO trend
            $trendPoSql = "SELECT DATE_FORMAT(COALESCE(received_date, order_date), '%Y-%m-%d') AS date, SUM(total_amount) AS total, SUM(paid_amount) AS cash_paid 
                           FROM purchase_orders 
                           WHERE " . ($hasShop ? 'shop_id = ?' : 'shop_id IS NOT NULL') . " AND status IN ('ordered', 'received') AND COALESCE(received_date, order_date) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) 
                           GROUP BY DATE_FORMAT(COALESCE(received_date, order_date), '%Y-%m-%d')";
            $stmt = DB::query($trendPoSql, $hasShop ? [$shopId] : []);
            while ($row = $stmt->fetch()) {
                $dt = $row['date'];
                if (isset($trendMap[$dt])) {
                    $trendMap[$dt]['inventory_purchasing_cost'] = (float)$row['total'];
                    $trendMap[$dt]['inventory_purchasing_cash_paid'] = (float)$row['cash_paid'];
                }
            }

            // Fetch daily other sales trend
            $trendOtherSalesSql = 'SELECT DATE_FORMAT(sale_date, "%Y-%m-%d") AS date, SUM(amount) AS revenue 
                                   FROM other_sales WHERE ' . ($hasShop ? 'shop_id = ?' : 'shop_id IS NOT NULL') . ' AND sale_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) 
                                   GROUP BY DATE_FORMAT(sale_date, "%Y-%m-%d")';
            $stmt = DB::query($trendOtherSalesSql, $hasShop ? [$shopId] : []);
            while ($row = $stmt->fetch()) {
                $dt = $row['date'];
                if (isset($trendMap[$dt])) {
                    $trendMap[$dt]['other_sales_revenue'] = (float)$row['revenue'];
                }
            }

            // Calculate profit fields on trend map
            foreach ($trendMap as $dateStr => &$d) {
                $dailyRefunds = $d['customer_returns'];
                $dailyReturnedCOGS = $d['returned_cogs'];
                $d['net_profit_cogs'] = $d['sales_revenue'] + $d['other_sales_revenue'] - ($d['cost_of_goods_sold'] - $dailyReturnedCOGS) - $d['other_costs'] - $d['wastage_loss'] - $dailyRefunds;
                $d['net_profit_cashflow'] = $d['sales_cash_received'] + $d['other_sales_revenue'] - $d['inventory_purchasing_cash_paid'] - $d['other_costs'] - $d['wastage_loss'] - $dailyRefunds;
            }

            $trend = array_values($trendMap);

            // 10. Manual Order metrics
            $manualSql = 'SELECT 
                            COUNT(CASE WHEN mo.status = "pending" THEN 1 END) AS pending_count,
                            COUNT(CASE WHEN mo.status = "confirmed" THEN 1 END) AS confirmed_count,
                            COALESCE(SUM(CASE WHEN mo.status = "confirmed" THEN s.final_amount END), 0) AS confirmed_value,
                            COALESCE(SUM(CASE WHEN mo.status = "confirmed" THEN s.paid_amount END), 0) AS confirmed_paid,
                            COALESCE(SUM(CASE WHEN mo.status = "confirmed" THEN s.due_amount END), 0) AS confirmed_due
                          FROM manual_orders mo
                          LEFT JOIN sales s ON mo.sale_id = s.id
                          WHERE ' . ($hasShop ? 'mo.shop_id = ?' : 'mo.shop_id IS NOT NULL');
            $manualParams = $hasShop ? [$shopId] : [];
            if (!empty($startDate) && !empty($endDate)) {
                $manualSql .= ' AND mo.created_at BETWEEN ? AND ?';
                $manualParams[] = "$startDate 00:00:00";
                $manualParams[] = "$endDate 23:59:59";
            }
            $stmt = DB::query($manualSql, $manualParams);
            $manualRow = $stmt->fetch();

            // Calculate value of pending drafts
            $pendingSql = 'SELECT COALESCE(SUM(moi.subtotal), 0) as pending_value
                           FROM manual_order_items moi
                           JOIN manual_orders mo ON moi.order_id = mo.id
                           WHERE mo.status = "pending" AND ' . ($hasShop ? 'mo.shop_id = ?' : 'mo.shop_id IS NOT NULL');
            $pendingParams = $hasShop ? [$shopId] : [];
            if (!empty($startDate) && !empty($endDate)) {
                $pendingSql .= ' AND mo.created_at BETWEEN ? AND ?';
                $pendingParams[] = "$startDate 00:00:00";
                $pendingParams[] = "$endDate 23:59:59";
            }
            $stmt = DB::query($pendingSql, $pendingParams);
            $pendingValue = (float)$stmt->fetchColumn();

            $manualMetrics = [
                'pending_count' => (int)($manualRow['pending_count'] ?? 0),
                'confirmed_count' => (int)($manualRow['confirmed_count'] ?? 0),
                'confirmed_value' => (float)($manualRow['confirmed_value'] ?? 0),
                'confirmed_paid' => (float)($manualRow['confirmed_paid'] ?? 0),
                'confirmed_due' => (float)($manualRow['confirmed_due'] ?? 0),
                'pending_value' => $pendingValue
            ];

            header('Content-Type: application/json');
            echo json_encode([
                'sales_revenue' => $totalSales,
                'sales_cash_received' => $totalSalesCash,
                'sales_count' => $salesCount,
                'other_sales_revenue' => $totalOtherSales,
                'cost_of_goods_sold' => $totalCOGS - $totalReturnedCOGS,
                'customer_returns' => $totalRefunds,
                'inventory_purchasing_cost' => $totalPurchasing,
                'inventory_purchasing_cash_paid' => $totalPurchasingCash,
                'supplier_due' => $totalSupplierDue,
                'customer_due' => $totalCustomerDue,
                'other_costs' => $totalOther,
                'wastage_loss' => $totalWastage,
                'net_profit_cogs' => $netProfitCOGS,
                'net_profit_cashflow' => $netProfitCashflow,
                'trend' => $trend,
                'manual_orders' => $manualMetrics
            ]);

        } catch (\Exception $e) {
            error_log('Revenue breakdown error: ' . $e->getMessage());
            Auth::jsonError('Server error generating revenue analytics.', 500);
        }
    }

    public static function getDashboardData() {
        Auth::authenticate();
        $user = Auth::$user;
        $role = $user['role'];

        try {
            if ($role === 'super_admin') {
                // 1. Super Admin Global Analytics
                $stmt = DB::query('SELECT COUNT(*) as total_shops, SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as active_shops FROM shops');
                $shopStats = $stmt->fetch();
                
                $stmt = DB::query('SELECT COUNT(*) as total_users FROM users WHERE role != "super_admin"');
                $userStats = $stmt->fetch();

                $stmt = DB::query('SELECT COUNT(*) as total_sales, SUM(final_amount) as global_revenue FROM sales WHERE shop_id IS NOT NULL');
                $salesStats = $stmt->fetch();

                $stmt = DB::query('SELECT SUM(amount) as global_other_sales FROM other_sales WHERE shop_id IS NOT NULL');
                $globalOtherSales = (float)($stmt->fetchColumn() ?: 0);
                $totalGlobalRevenue = (float)($salesStats['global_revenue'] ?? 0) + $globalOtherSales;

                $stmt = DB::query('SELECT sh.id as shop_id, sh.name as shop_name, COUNT(s.id) as sales_count, SUM(s.final_amount) as shop_revenue
                                   FROM shops sh
                                   LEFT JOIN sales s ON sh.id = s.shop_id
                                   GROUP BY sh.id
                                   ORDER BY shop_revenue DESC');
                $tenantSales = $stmt->fetchAll();
                
                // Add other sales to each tenant
                foreach ($tenantSales as &$ts) {
                    $stmtOS = DB::query('SELECT SUM(amount) FROM other_sales WHERE shop_id = ?', [$ts['shop_id'] ?? 0]);
                    $osAmount = (float)($stmtOS->fetchColumn() ?: 0);
                    $ts['sales_count'] = (int)$ts['sales_count'];
                    $ts['shop_revenue'] = (float)$ts['shop_revenue'] + $osAmount;
                }

                // Today's global revenue
                $stmt = DB::query("SELECT COALESCE(SUM(final_amount), 0) as today_revenue, COUNT(id) as today_sales FROM sales WHERE shop_id IS NOT NULL AND DATE(created_at) = CURDATE()");
                $todayRow = $stmt->fetch();
                $stmt = DB::query("SELECT COALESCE(SUM(amount), 0) as today_other FROM other_sales WHERE shop_id IS NOT NULL AND DATE(sale_date) = CURDATE()");
                $todayOtherRevenue = (float)($stmt->fetchColumn() ?: 0);
                $todayRevenue = (float)($todayRow['today_revenue'] ?? 0) + $todayOtherRevenue;
                $todaySalesCount = (int)($todayRow['today_sales'] ?? 0);

                // 7-day global revenue + sales trend
                $trendMap = [];
                for ($i = 6; $i >= 0; $i--) {
                    $dateStr = date('Y-m-d', strtotime("-$i days"));
                    $trendMap[$dateStr] = ['date' => $dateStr, 'revenue' => 0.0, 'sales_count' => 0];
                }

                // Global sales per day (all shops)
                $stmt = DB::query("SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as sale_date,
                                          SUM(final_amount) as daily_revenue,
                                          COUNT(id) as daily_sales
                                   FROM sales
                                   WHERE shop_id IS NOT NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                                   GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
                                   ORDER BY sale_date ASC");
                $trendSalesRows = $stmt->fetchAll();
                foreach ($trendSalesRows as $row) {
                    $sd = $row['sale_date'];
                    if (isset($trendMap[$sd])) {
                        $trendMap[$sd]['revenue'] += (float)$row['daily_revenue'];
                        $trendMap[$sd]['sales_count'] += (int)$row['daily_sales'];
                    }
                }

                // Global other_sales per day (all shops)
                $stmt = DB::query("SELECT DATE_FORMAT(sale_date, '%Y-%m-%d') as os_date, SUM(amount) as daily_os_revenue
                                   FROM other_sales
                                   WHERE shop_id IS NOT NULL AND sale_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                                   GROUP BY DATE_FORMAT(sale_date, '%Y-%m-%d')");
                $osTrendRows = $stmt->fetchAll();
                foreach ($osTrendRows as $row) {
                    $osd = $row['os_date'];
                    if (isset($trendMap[$osd])) {
                        $trendMap[$osd]['revenue'] += (float)$row['daily_os_revenue'];
                    }
                }

                $salesTrend = array_values($trendMap);

                header('Content-Type: application/json');
                echo json_encode([
                    'dashboard_type' => 'super_admin',
                    'metrics' => [
                        'total_shops'    => (int)($shopStats['total_shops'] ?? 0),
                        'active_shops'   => (int)($shopStats['active_shops'] ?? 0),
                        'total_users'    => (int)($userStats['total_users'] ?? 0),
                        'total_sales'    => (int)($salesStats['total_sales'] ?? 0),
                        'global_revenue' => number_format($totalGlobalRevenue, 2, '.', ''),
                        'today_revenue'  => number_format($todayRevenue, 2, '.', ''),
                        'today_sales'    => $todaySalesCount,
                    ],
                    'tenant_breakdown' => $tenantSales,
                    'sales_trend'      => $salesTrend,
                ]);

            } else {
                // 2. Tenant Specific Analytics
                $shopId = Auth::$shopId;

                $stmt = DB::query('SELECT COUNT(*) as sales_count, SUM(final_amount) as revenue FROM sales WHERE shop_id = ?', [$shopId]);
                $salesStats = $stmt->fetch();

                $stmt = DB::query('SELECT SUM(amount) as other_sales_revenue FROM other_sales WHERE shop_id = ?', [$shopId]);
                $tenantOtherSales = (float)($stmt->fetchColumn() ?: 0);
                $tenantTotalRevenue = (float)($salesStats['revenue'] ?? 0) + $tenantOtherSales;

                $stmt = DB::query('SELECT COUNT(*) as total_products, SUM(CASE WHEN stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_count
                                   FROM products WHERE shop_id = ?', [$shopId]);
                $productStats = $stmt->fetch();

                $stmt = DB::query('SELECT COUNT(*) as total_customers FROM customers WHERE shop_id = ?', [$shopId]);
                $customerStats = $stmt->fetch();

                // Recent sales
                $stmt = DB::query('SELECT s.id, s.final_amount, s.payment_method, s.created_at, u.name as staff_name 
                                   FROM sales s
                                   JOIN users u ON s.user_id = u.id
                                   WHERE s.shop_id = ? 
                                   ORDER BY s.created_at DESC 
                                   LIMIT 5', [$shopId]);
                $recentSales = $stmt->fetchAll();
                foreach ($recentSales as &$sale) {
                    $sale['id'] = (int)$sale['id'];
                    $sale['final_amount'] = (float)$sale['final_amount'];
                }

                // 7-day trend (Combine Sales + Other Sales)
                $stmt = DB::query("SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as sale_date,
                                          SUM(final_amount) as daily_revenue,
                                          COUNT(id) as daily_sales
                                   FROM sales
                                   WHERE shop_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                                   GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
                                   ORDER BY sale_date ASC", [$shopId]);
                $trendRows = $stmt->fetchAll();

                // Also get Other Sales 7-day trend for dashboard
                $stmt = DB::query("SELECT DATE_FORMAT(sale_date, '%Y-%m-%d') as os_date,
                                          SUM(amount) as daily_os_revenue
                                   FROM other_sales
                                   WHERE shop_id = ? AND sale_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                                   GROUP BY DATE_FORMAT(sale_date, '%Y-%m-%d')", [$shopId]);
                $osTrendRows = $stmt->fetchAll();
                $osTrendMap = [];
                foreach ($osTrendRows as $osr) {
                    $osTrendMap[$osr['os_date']] = (float)$osr['daily_os_revenue'];
                }

                // Payment breakdown
                $stmt = DB::query('SELECT payment_method, COUNT(*) as count, SUM(final_amount) as total
                                   FROM sales WHERE shop_id = ? GROUP BY payment_method', [$shopId]);
                $paymentBreakdown = $stmt->fetchAll();
                foreach ($paymentBreakdown as &$pb) {
                    $pb['count'] = (int)$pb['count'];
                    $pb['total'] = (float)$pb['total'];
                }

                // Top Selling (5)
                $stmt = DB::query('SELECT p.id, p.name, p.sku, p.stock_quantity, p.price, p.unit,
                                          COALESCE(SUM(si.quantity), 0) as total_sold,
                                          COALESCE(SUM(si.subtotal), 0) as total_revenue
                                   FROM products p
                                   JOIN sale_items si ON p.id = si.product_id
                                   WHERE p.shop_id = ?
                                   GROUP BY p.id, p.name, p.sku, p.stock_quantity, p.price, p.unit
                                   ORDER BY total_sold DESC
                                   LIMIT 5', [$shopId]);
                $topSelling = $stmt->fetchAll();
                foreach ($topSelling as &$ts) {
                    $ts['id'] = (int)$ts['id'];
                    $ts['stock_quantity'] = (int)$ts['stock_quantity'];
                    $ts['price'] = (float)$ts['price'];
                    $ts['total_sold'] = (int)$ts['total_sold'];
                    $ts['total_revenue'] = (float)$ts['total_revenue'];
                }

                // Dead stock (5)
                $stmt = DB::query('SELECT p.id, p.name, p.sku, p.stock_quantity, p.price, p.unit
                                   FROM products p
                                   LEFT JOIN sale_items si ON p.id = si.product_id
                                   WHERE p.shop_id = ? AND p.stock_quantity > 0 AND si.id IS NULL
                                   ORDER BY p.stock_quantity DESC
                                   LIMIT 5', [$shopId]);
                $deadStock = $stmt->fetchAll();
                foreach ($deadStock as &$ds) {
                    $ds['id'] = (int)$ds['id'];
                    $ds['stock_quantity'] = (int)$ds['stock_quantity'];
                    $ds['price'] = (float)$ds['price'];
                }

                // Compile trend map with 7-days points
                $trendMap = [];
                for ($i = 6; $i >= 0; $i--) {
                    $dateStr = date('Y-m-d', strtotime("-$i days"));
                    $trendMap[$dateStr] = ['date' => $dateStr, 'revenue' => 0.0, 'sales_count' => 0];
                }
                foreach ($trendRows as $row) {
                    $sd = $row['sale_date'];
                    if (isset($trendMap[$sd])) {
                        $trendMap[$sd]['revenue'] = (float)$row['daily_revenue'] + ($osTrendMap[$sd] ?? 0.0);
                        $trendMap[$sd]['sales_count'] = (int)$row['daily_sales'];
                    }
                }
                
                // Ensure days with ONLY other sales are added
                foreach ($osTrendMap as $osd => $osAmount) {
                    if (isset($trendMap[$osd]) && !isset($trendMap[$osd]['has_sales'])) {
                        $trendMap[$osd]['revenue'] += $osAmount;
                        $trendMap[$osd]['has_sales'] = true;
                    }
                }
                
                $salesTrend = array_values($trendMap);

                header('Content-Type: application/json');
                echo json_encode([
                    'dashboard_type' => 'tenant',
                    'metrics' => [
                        'total_sales' => (int)($salesStats['sales_count'] ?? 0),
                        'revenue' => number_format($tenantTotalRevenue, 2, '.', ''),
                        'total_products' => (int)($productStats['total_products'] ?? 0),
                        'low_stock_alerts' => (int)($productStats['low_stock_count'] ?? 0),
                        'total_customers' => (int)($customerStats['total_customers'] ?? 0)
                    ],
                    'recent_sales' => $recentSales,
                    'sales_trend' => $salesTrend,
                    'payment_method_breakdown' => $paymentBreakdown,
                    'top_selling' => $topSelling,
                    'dead_stock' => $deadStock
                ]);
            }

        } catch (\Exception $e) {
            error_log('Analytics dashboard data error: ' . $e->getMessage());
            Auth::jsonError('Server error generating dashboard analytics.', 500);
        }
    }

    public static function getDailyProductSales() {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;
        $startDate = $_GET['start_date'] ?? null;
        $endDate = $_GET['end_date'] ?? null;

        if (empty($startDate) || empty($endDate)) {
            Auth::jsonError('Please provide both a start and end date.', 400);
        }

        try {
            $sql = 'SELECT 
                        p.id as product_id,
                        p.name as product_name,
                        p.sku as product_sku,
                        SUM(si.quantity) as total_quantity_sold,
                        SUM(si.subtotal) as total_revenue
                    FROM sale_items si
                    JOIN products p ON si.product_id = p.id
                    JOIN sales s ON si.sale_id = s.id
                    WHERE si.shop_id = ? AND DATE(s.created_at) BETWEEN ? AND ?
                    GROUP BY p.id, p.name, p.sku
                    ORDER BY total_quantity_sold DESC';

            $stmt = DB::query($sql, [$shopId, $startDate, $endDate]);
            $productSales = $stmt->fetchAll();

            foreach ($productSales as &$ps) {
                $ps['product_id'] = (int)$ps['product_id'];
                $ps['total_quantity_sold'] = (int)$ps['total_quantity_sold'];
                $ps['total_revenue'] = (float)$ps['total_revenue'];
            }

            header('Content-Type: application/json');
            echo json_encode($productSales);

        } catch (\Exception $e) {
            error_log('Fetch daily product sales error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving daily product sales.', 500);
        }
    }
}
