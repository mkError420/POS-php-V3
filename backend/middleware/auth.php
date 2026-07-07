<?php
/**
 * JWT Authentication Middleware
 */

class JWT {
    public static function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    public static function base64UrlDecode($data) {
        return base64_decode(str_pad(strtr($data, '-_', '+/'), strlen($data) % 4, '=', STR_PAD_RIGHT));
    }

    public static function sign($payload, $secret) {
        $header = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
        $payloadJson = json_encode($payload);

        $base64UrlHeader = self::base64UrlEncode($header);
        $base64UrlPayload = self::base64UrlEncode($payloadJson);

        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
        $base64UrlSignature = self::base64UrlEncode($signature);

        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }

    public static function verify($token, $secret) {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return false;
        }

        list($header, $payload, $signature) = $parts;
        $validSignature = hash_hmac('sha256', $header . "." . $payload, $secret, true);
        $validSignatureEncoded = self::base64UrlEncode($validSignature);

        if (!hash_equals($validSignatureEncoded, $signature)) {
            return false;
        }

        $decodedPayload = json_decode(self::base64UrlDecode($payload), true);
        
        // Verify expiration
        if (isset($decodedPayload['exp']) && $decodedPayload['exp'] < time()) {
            return false;
        }

        return $decodedPayload;
    }
}

class Auth {
    public static $user = null;
    public static $shopId = null;

    public static function authenticate() {
        $authHeader = null;
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        } else {
            $headers = getallheaders();
            $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
        }

        if (!$authHeader || strpos($authHeader, 'Bearer ') !== 0) {
            self::jsonError('Access denied. No token provided.', 401);
        }

        $token = substr($authHeader, 7);
        $secret = getenv('JWT_SECRET') ?: 'super_secret_pos_key_2026';
        $decoded = JWT::verify($token, $secret);

        if (!$decoded) {
            self::jsonError('Unauthorized. Invalid or expired token.', 403);
        }

        self::$user = $decoded;

        // Enforce Tenant Isolation:
        // If super_admin, they can query across all shops. They can supply shop_id via query/body parameters.
        // If shop_admin or shop_staff, their shopId is strictly bound to the token's shop_id and cannot be overridden.
        if (self::$user['role'] === 'super_admin') {
            // Read body parameters if JSON
            $input = json_decode(file_get_contents('php://input'), true) ?: [];
            $paramShopId = $_GET['shop_id'] ?? $input['shop_id'] ?? null;
            self::$shopId = $paramShopId !== null ? (int)$paramShopId : null;
        } else {
            self::$shopId = isset(self::$user['shop_id']) ? (int)self::$user['shop_id'] : null;
        }
    }

    public static function authorize($roles = []) {
        if (!self::$user) {
            self::jsonError('Authentication required.', 401);
        }

        // Allow super_admin to perform all actions
        if (self::$user['role'] === 'super_admin') {
            return;
        }

        if (!in_array(self::$user['role'], $roles)) {
            error_log("Authorization failed: User role '" . self::$user['role'] . "' not in allowed roles [" . implode(', ', $roles) . "] for URI: " . ($_SERVER['REQUEST_URI'] ?? ''));
            self::jsonError('Forbidden. Insufficient permissions.', 403);
        }
    }

    public static function enforceTenant($force = false) {
        if (($force || self::$user['role'] !== 'super_admin') && self::$shopId === null) {
            self::jsonError('Bad request. Tenant shop identification is missing.', 400);
        }
    }

    public static function jsonError($message, $code = 400) {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode(['error' => $message]);
        exit;
    }
}
