<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/AuthController.php';

class ChatController {
    
    private static function getAuthHeader() {
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            return $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        } else if (function_exists('getallheaders')) {
            $headers = getallheaders();
            return $headers['Authorization'] ?? $headers['authorization'] ?? null;
        }
        return null;
    }

    
    // GET /api/chat/:session_id
    // Fetch messages for a specific session (Guest or Admin)
    public static function getSessionMessages($sessionId) {
        try {
            $pdo = DB::getConnection();
            
            $authHeader = self::getAuthHeader();
            $isAdmin = false;
            if ($authHeader) {
                // Potential admin
                $token = str_replace('Bearer ', '', $authHeader);
                $secret = getenv('JWT_SECRET') ?: 'super_secret_pos_key_2026';
                try {
                    $decoded = JWT::verify($token, $secret);
                    if ($decoded && $decoded['role'] === 'super_admin') {
                        $isAdmin = true;
                    }
                } catch (\Exception $e) {}
            }

            if ($isAdmin) {
                // Fetch messages excluding those deleted by admin
                $stmt = $pdo->prepare("SELECT * FROM chat_messages WHERE session_id = ? AND deleted_by_admin = 0 ORDER BY created_at ASC");
                $stmt->execute([$sessionId]);
                
                $updateStmt = $pdo->prepare("UPDATE chat_messages SET is_read = 1 WHERE session_id = ? AND sender_type = 'guest' AND is_read = 0");
                $updateStmt->execute([$sessionId]);
            } else {
                // Guest fetches all messages (even those hidden by admin)
                $stmt = $pdo->prepare("SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC");
                $stmt->execute([$sessionId]);
                
                $updateStmt = $pdo->prepare("UPDATE chat_messages SET is_read = 1 WHERE session_id = ? AND sender_type = 'super_admin' AND is_read = 0");
                $updateStmt->execute([$sessionId]);
            }
            
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            header('Content-Type: application/json');
            echo json_encode($messages);
        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to fetch messages: ' . $e->getMessage()]);
        }
    }
    
    // POST /api/chat/:session_id
    // Send a message
    public static function sendMessage($sessionId, $data) {
        if (!isset($data['message']) || trim($data['message']) === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Message is required']);
            return;
        }
        
        $message = trim($data['message']);
        $senderName = isset($data['sender_name']) ? trim($data['sender_name']) : 'Guest';
        $senderType = 'guest'; // Default
        
        // Check if admin is sending
        $authHeader = self::getAuthHeader();
        if ($authHeader) {
            $token = str_replace('Bearer ', '', $authHeader);
            $secret = getenv('JWT_SECRET') ?: 'super_secret_pos_key_2026';
            $decoded = JWT::verify($token, $secret);
            if ($decoded && $decoded['role'] === 'super_admin') {
                $senderType = 'super_admin';
                $senderName = 'Codexaa';
            }
        }

        try {
            $pdo = DB::getConnection();
            $stmt = $pdo->prepare("INSERT INTO chat_messages (session_id, sender_type, sender_name, message) VALUES (?, ?, ?, ?)");
            $stmt->execute([$sessionId, $senderType, $senderName, $message]);
            
            $newMessageId = $pdo->lastInsertId();
            
            $fetchStmt = $pdo->prepare("SELECT * FROM chat_messages WHERE id = ?");
            $fetchStmt->execute([$newMessageId]);
            $msg = $fetchStmt->fetch(PDO::FETCH_ASSOC);
            
            header('Content-Type: application/json');
            echo json_encode(['success' => true, 'message' => $msg]);
        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to send message: ' . $e->getMessage()]);
        }
    }
    
    // GET /api/superadmin/chats
    // Fetch all active chat sessions (for super admin)
    public static function getActiveSessions() {
        Auth::authenticate();
        Auth::authorize(['super_admin']);
        
        try {
            $pdo = DB::getConnection();
            
            // Get sessions with their latest message and unread count
            $query = "
                SELECT 
                    c1.session_id,
                    c1.sender_name,
                    c1.message as last_message,
                    c1.created_at as last_message_time,
                    (SELECT COUNT(*) FROM chat_messages c3 WHERE c3.session_id = c1.session_id AND c3.is_read = 0 AND c3.sender_type = 'guest') as unread_count
                FROM chat_messages c1
                INNER JOIN (
                    SELECT session_id, MAX(id) as max_id
                    FROM chat_messages
                    WHERE deleted_by_admin = 0
                    GROUP BY session_id
                ) c2 ON c1.session_id = c2.session_id AND c1.id = c2.max_id
                ORDER BY c1.created_at DESC
            ";
            
            $stmt = $pdo->query($query);
            $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            header('Content-Type: application/json');
            echo json_encode($sessions);
        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to fetch sessions: ' . $e->getMessage()]);
        }
    }

    // DELETE /api/superadmin/chats/:session_id
    // Delete a chat session
    public static function deleteSession($sessionId, $data) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);
        
        $mode = $data['mode'] ?? 'for_me';
        try {
            $pdo = DB::getConnection();
            if ($mode === 'for_everyone') {
                $stmt = $pdo->prepare("DELETE FROM chat_messages WHERE session_id = ?");
                $stmt->execute([$sessionId]);
            } else {
                $stmt = $pdo->prepare("UPDATE chat_messages SET deleted_by_admin = 1 WHERE session_id = ?");
                $stmt->execute([$sessionId]);
            }
            
            header('Content-Type: application/json');
            echo json_encode(['success' => true]);
        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to delete session: ' . $e->getMessage()]);
        }
    }
}
