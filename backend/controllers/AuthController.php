<?php
/**
 * Auth Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

class AuthController {

    public static function login($requestData) {
        $email = $requestData['email'] ?? '';
        $password = $requestData['password'] ?? '';

        if (empty($email) || empty($password)) {
            Auth::jsonError('Please provide email and password.', 400);
        }

        try {
            // Fetch user and shop status
            $stmt = DB::query(
                'SELECT u.*, s.name as shop_name, s.status as shop_status, s.subscription_expires_at, s.subscription_status 
                 FROM users u 
                 LEFT JOIN shops s ON u.shop_id = s.id 
                 WHERE u.email = ?',
                [$email]
            );
            $user = $stmt->fetch();

            if (!$user) {
                Auth::jsonError('Invalid mail or password', 401);
            }

            // Check user status
            if ($user['status'] !== 'active') {
                Auth::jsonError('Your account is suspended.', 403);
            }

            // Check shop status and subscription
            if ($user['role'] !== 'super_admin' && $user['shop_id']) {
                if ($user['subscription_status'] === 'pending') {
                    Auth::jsonError('Your subscription registration is pending verification. Please wait for administrator approval.', 403);
                }
                if ($user['shop_status'] !== 'active') {
                    Auth::jsonError('This shop has been suspended. Please contact the system administrator.', 403);
                }
                if ($user['subscription_status'] === 'expired' || (!empty($user['subscription_expires_at']) && strtotime($user['subscription_expires_at']) < time())) {
                    if ($user['subscription_status'] !== 'expired') {
                        DB::query("UPDATE shops SET subscription_status = 'expired' WHERE id = ?", [$user['shop_id']]);
                    }
                    Auth::jsonError('Your subscription plan has expired. Please contact the system administrator to renew.', 403);
                }
            }

            // Compare passwords using password_verify (compatible with Node's bcryptjs)
            // Wait, Node's seed hash starts with $2a$. password_verify supports this.
            if (!password_verify($password, $user['password_hash'])) {
                Auth::jsonError('Invalid mail or password', 401);
            }

            // Generate JWT
            $allowed_sections = null;
            if (!empty($user['allowed_sections'])) {
                $allowed_sections = json_decode($user['allowed_sections'], true);
            }

            $payload = [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'shop_id' => $user['shop_id'] !== null ? (int)$user['shop_id'] : null,
                'shop_name' => $user['shop_name'] ?: 'Global System',
                'allowed_sections' => $allowed_sections,
                'exp' => time() + 8 * 3600 // 8 hours expiry
            ];

            $secret = getenv('JWT_SECRET') ?: 'super_secret_pos_key_2026';
            $token = JWT::sign($payload, $secret);

            header('Content-Type: application/json');
            echo json_encode([
                'token' => $token,
                'user' => [
                    'id' => (int)$user['id'],
                    'name' => $user['name'],
                    'email' => $user['email'],
                    'role' => $user['role'],
                    'shop_id' => $user['shop_id'] !== null ? (int)$user['shop_id'] : null,
                    'shop_name' => $user['shop_name'] ?: 'Global System',
                    'allowed_sections' => $allowed_sections,
                    'logo' => $user['logo']
                ]
            ]);

        } catch (\Exception $e) {
            error_log('Login error: ' . $e->getMessage());
            Auth::jsonError('Server error during login.', 500);
        }
    }

    public static function getMe() {
        Auth::authenticate();
        $userId = Auth::$user['id'];

        try {
            $stmt = DB::query(
                'SELECT u.id, u.name, u.email, u.role, u.shop_id, u.allowed_sections, u.logo, s.name as shop_name, s.status as shop_status, s.subscription_expires_at, s.subscription_status 
                 FROM users u 
                 LEFT JOIN shops s ON u.shop_id = s.id 
                 WHERE u.id = ? AND u.status = "active"',
                [$userId]
            );
            $user = $stmt->fetch();

            if (!$user) {
                Auth::jsonError('User not found or account suspended.', 404);
            }

            if ($user['role'] !== 'super_admin' && $user['shop_id']) {
                if ($user['subscription_status'] === 'pending') {
                    Auth::jsonError('Your subscription registration is pending verification. Please wait for administrator approval.', 403);
                }
                if ($user['shop_status'] !== 'active') {
                    Auth::jsonError('This shop has been suspended. Please contact the system administrator.', 403);
                }
                if ($user['subscription_status'] === 'expired' || (!empty($user['subscription_expires_at']) && strtotime($user['subscription_expires_at']) < time())) {
                    if ($user['subscription_status'] !== 'expired') {
                        DB::query("UPDATE shops SET subscription_status = 'expired' WHERE id = ?", [$user['shop_id']]);
                    }
                    Auth::jsonError('Your subscription plan has expired. Please contact the system administrator to renew.', 403);
                }
            }

            $allowed_sections = null;
            if (!empty($user['allowed_sections'])) {
                $allowed_sections = json_decode($user['allowed_sections'], true);
            }

            header('Content-Type: application/json');
            echo json_encode([
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'shop_id' => $user['shop_id'] !== null ? (int)$user['shop_id'] : null,
                'shop_name' => $user['shop_name'] ?: 'Global System',
                'allowed_sections' => $allowed_sections,
                'logo' => $user['logo']
            ]);

        } catch (\Exception $e) {
            error_log('Get me error: ' . $e->getMessage());
            Auth::jsonError('Server error fetching user profile.', 500);
        }
    }

    public static function updateMe($requestData) {
        Auth::authenticate();
        $userId = Auth::$user['id'];

        $name = $requestData['name'] ?? '';
        $email = $requestData['email'] ?? '';
        $password = $requestData['password'] ?? '';
        $logo = isset($requestData['logo']) ? $requestData['logo'] : null;

        if (empty($name) || empty($email)) {
            Auth::jsonError('Name and email are required.', 400);
        }

        try {
            // Check if email already in use
            $stmt = DB::query('SELECT id FROM users WHERE email = ? AND id != ?', [$email, $userId]);
            if ($stmt->fetch()) {
                Auth::jsonError('Email already in use by another account.', 400);
            }

            $updateFields = ['name = ?', 'email = ?'];
            $queryParams = [$name, $email];

            if (!empty($password)) {
                if (strlen($password) < 6) {
                    Auth::jsonError('Password must be at least 6 characters long.', 400);
                }
                $passwordHash = password_hash($password, PASSWORD_BCRYPT);
                $updateFields[] = 'password_hash = ?';
                $queryParams[] = $passwordHash;
            }

            if ($logo !== null) {
                $updateFields[] = 'logo = ?';
                $queryParams[] = $logo;
            }

            $queryParams[] = $userId;

            DB::query(
                "UPDATE users SET " . implode(', ', $updateFields) . " WHERE id = ? AND status = 'active'",
                $queryParams
            );

            // Fetch updated user details
            $stmt = DB::query(
                'SELECT u.id, u.name, u.email, u.role, u.shop_id, u.allowed_sections, u.logo, s.name as shop_name 
                 FROM users u 
                 LEFT JOIN shops s ON u.shop_id = s.id 
                 WHERE u.id = ?',
                [$userId]
            );
            $updatedUser = $stmt->fetch();

            if (!$updatedUser) {
                Auth::jsonError('User not found.', 404);
            }

            $allowed_sections = null;
            if (!empty($updatedUser['allowed_sections'])) {
                $allowed_sections = json_decode($updatedUser['allowed_sections'], true);
            }

            // Generate updated JWT payload (excludes logo to avoid heavy token headers)
            $payload = [
                'id' => (int)$updatedUser['id'],
                'name' => $updatedUser['name'],
                'email' => $updatedUser['email'],
                'role' => $updatedUser['role'],
                'shop_id' => $updatedUser['shop_id'] !== null ? (int)$updatedUser['shop_id'] : null,
                'shop_name' => $updatedUser['shop_name'] ?: 'Global System',
                'allowed_sections' => $allowed_sections,
                'exp' => time() + 8 * 3600
            ];

            $secret = getenv('JWT_SECRET') ?: 'super_secret_pos_key_2026';
            $token = JWT::sign($payload, $secret);

            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'Profile updated successfully.',
                'token' => $token,
                'user' => [
                    'id' => (int)$updatedUser['id'],
                    'name' => $updatedUser['name'],
                    'email' => $updatedUser['email'],
                    'role' => $updatedUser['role'],
                    'shop_id' => $updatedUser['shop_id'] !== null ? (int)$updatedUser['shop_id'] : null,
                    'shop_name' => $updatedUser['shop_name'] ?: 'Global System',
                    'allowed_sections' => $allowed_sections,
                    'logo' => $updatedUser['logo']
                ]
            ]);

        } catch (\Exception $e) {
            error_log('Update me error: ' . $e->getMessage());
            Auth::jsonError('Server error updating user profile.', 500);
        }
    }

    public static function registerShop($requestData) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        $shopName = $requestData['shop_name'] ?? '';
        $shopEmail = $requestData['shop_email'] ?? '';
        $shopPhone = $requestData['shop_phone'] ?? '';
        $shopAddress = $requestData['shop_address'] ?? '';
        $adminName = $requestData['admin_name'] ?? '';
        $adminEmail = $requestData['admin_email'] ?? '';
        $adminPassword = $requestData['admin_password'] ?? '';

        if (empty($shopName) || empty($shopEmail) || empty($adminName) || empty($adminEmail) || empty($adminPassword)) {
            Auth::jsonError('Please provide all required shop and admin details.', 400);
        }

        try {
            DB::beginTransaction();

            // Verify admin email uniqueness
            $stmt = DB::query('SELECT id FROM users WHERE email = ?', [$adminEmail]);
            if ($stmt->fetch()) {
                DB::rollBack();
                Auth::jsonError('Admin email already exists in the system.', 400);
            }

            // Verify shop email uniqueness
            $stmt = DB::query('SELECT id FROM shops WHERE email = ?', [$shopEmail]);
            if ($stmt->fetch()) {
                DB::rollBack();
                Auth::jsonError('Shop email already registered.', 400);
            }

            // 1. Create the shop
            DB::query(
                'INSERT INTO shops (name, email, phone, address) VALUES (?, ?, ?, ?)',
                [$shopName, $shopEmail, $shopPhone, $shopAddress]
            );
            $newShopId = DB::lastInsertId();

            // 2. Hash admin password
            $passwordHash = password_hash($adminPassword, PASSWORD_BCRYPT);

            // 3. Create shop admin user
            DB::query(
                'INSERT INTO users (shop_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
                [$newShopId, $adminName, $adminEmail, $passwordHash, 'shop_admin']
            );

            DB::commit();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Tenant shop and administrator registered successfully.',
                'shop_id' => (int)$newShopId
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Register shop error: ' . $e->getMessage());
            Auth::jsonError('Failed to create shop and administrator.', 500);
        }
    }

    public static function publicSignup($requestData) {
        $shopName = $requestData['shop_name'] ?? '';
        $shopEmail = $requestData['shop_email'] ?? '';
        $shopPhone = $requestData['shop_phone'] ?? '';
        $shopAddress = $requestData['shop_address'] ?? '';
        
        $adminName = $requestData['admin_name'] ?? '';
        $adminEmail = $requestData['admin_email'] ?? '';
        $adminPassword = $requestData['admin_password'] ?? '';
        
        $packageId = $requestData['package_id'] ?? null;
        $paymentMethod = $requestData['payment_method'] ?? '';
        $transactionId = $requestData['transaction_id'] ?? '';
        $paymentProof = $requestData['payment_proof'] ?? null; // base64 encoded file

        if (empty($shopName) || empty($shopEmail) || empty($adminName) || empty($adminEmail) || empty($adminPassword) || empty($packageId) || empty($paymentMethod) || empty($transactionId) || empty($paymentProof)) {
            Auth::jsonError('Please provide all required details, payment selection, transaction ID and document proof.', 400);
        }

        try {
            DB::beginTransaction();

            // 1. Fetch package info
            $stmt = DB::query('SELECT * FROM subscription_packages WHERE id = ? AND status = "active"', [$packageId]);
            $package = $stmt->fetch();
            if (!$package) {
                DB::rollBack();
                Auth::jsonError('Selected subscription package is invalid or inactive.', 400);
            }

            // 2. Verify admin email uniqueness
            $stmt = DB::query('SELECT id FROM users WHERE email = ?', [$adminEmail]);
            if ($stmt->fetch()) {
                DB::rollBack();
                Auth::jsonError('Admin email already exists in the system.', 400);
            }

            // 3. Verify shop email uniqueness
            $stmt = DB::query('SELECT id FROM shops WHERE email = ?', [$shopEmail]);
            if ($stmt->fetch()) {
                DB::rollBack();
                Auth::jsonError('Shop email already registered.', 400);
            }

            // 4. Create the shop (status is inactive, subscription_status is pending)
            DB::query(
                'INSERT INTO shops (name, email, phone, address, status, subscription_package_id, subscription_status, payment_method, transaction_id, payment_proof) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [$shopName, $shopEmail, $shopPhone, $shopAddress, 'inactive', $packageId, 'pending', $paymentMethod, $transactionId, $paymentProof]
            );
            $newShopId = DB::lastInsertId();

            // 5. Hash admin password
            $passwordHash = password_hash($adminPassword, PASSWORD_BCRYPT);

            // 6. Create shop admin user
            DB::query(
                'INSERT INTO users (shop_id, name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)',
                [$newShopId, $adminName, $adminEmail, $passwordHash, 'shop_admin', 'active']
            );

            DB::commit();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Subscription request submitted successfully. Please wait for administrator verification.',
                'status' => 'pending'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Public register shop error: ' . $e->getMessage());
            Auth::jsonError('Failed to complete subscription registration.', 500);
        }
    }
}
