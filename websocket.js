const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * WebSocket Server Manager
 * Handles real-time communication features including:
 * - User presence
 * - Instant messaging
 * - Live notifications
 * - Status updates
 */
class WebSocketManager {
    constructor(server) {
        // Initialize WebSocket server
        this.wss = new WebSocket.Server({ server });
        
        // Store active connections
        this.clients = new Map(); // Map<userId, WebSocket>
        this.userSessions = new Map(); // Map<userId, {lastSeen, status}>
        
        this.setupWebSocketServer();
    }

    setupWebSocketServer() {
        this.wss.on('connection', async (ws, req) => {
            try {
                // Extract token from query string
                const token = this.extractToken(req.url);
                if (!token) {
                    ws.close(4001, 'Authentication required');
                    return;
                }

                // Verify JWT token
                const decoded = await this.verifyToken(token);
                if (!decoded) {
                    ws.close(4002, 'Invalid token');
                    return;
                }

                const userId = decoded.id;
                
                // Store client connection
                this.clients.set(userId, ws);
                this.userSessions.set(userId, {
                    lastSeen: new Date(),
                    status: 'online'
                });

                // Broadcast user online status
                this.broadcastUserStatus(userId, 'online');

                // Setup message handler
                ws.on('message', (message) => this.handleMessage(userId, message));

                // Setup close handler
                ws.on('close', () => this.handleDisconnection(userId));

                // Setup error handler
                ws.on('error', (error) => this.handleError(userId, error));

                // Send initial connection success
                ws.send(JSON.stringify({
                    type: 'connection',
                    status: 'success',
                    userId
                }));

            } catch (error) {
                console.error('WebSocket connection error:', error);
                ws.close(4000, 'Connection error');
            }
        });
    }

    /**
     * Extract JWT token from WebSocket URL
     * @param {string} url - WebSocket connection URL
     * @returns {string|null} - Extracted token or null
     */
    extractToken(url) {
        try {
            const params = new URLSearchParams(url.split('?')[1]);
            return params.get('token');
        } catch (error) {
            console.error('Token extraction error:', error);
            return null;
        }
    }

    /**
     * Verify JWT token
     * @param {string} token - JWT token to verify
     * @returns {Promise<Object|null>} - Decoded token payload or null
     */
    async verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            console.error('Token verification error:', error);
            return null;
        }
    }

    /**
     * Handle incoming WebSocket messages
     * @param {string} userId - User ID of message sender
     * @param {WebSocket.Data} message - Raw message data
     */
    handleMessage(userId, message) {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'presence':
                    this.handlePresenceUpdate(userId, data.status);
                    break;
                case 'message':
                    this.handleChatMessage(userId, data);
                    break;
                case 'typing':
                    this.handleTypingIndicator(userId, data);
                    break;
                default:
                    console.warn(`Unknown message type: ${data.type}`);
            }
        } catch (error) {
            console.error('Message handling error:', error);
        }
    }

    /**
     * Handle user disconnection
     * @param {string} userId - ID of disconnected user
     */
    handleDisconnection(userId) {
        this.clients.delete(userId);
        this.userSessions.delete(userId);
        this.broadcastUserStatus(userId, 'offline');
    }

    /**
     * Handle WebSocket errors
     * @param {string} userId - User ID associated with error
     * @param {Error} error - Error object
     */
    handleError(userId, error) {
        console.error(`WebSocket error for user ${userId}:`, error);
        // Implement error recovery logic if needed
    }

    /**
     * Broadcast user status to all connected clients
     * @param {string} userId - User ID
     * @param {string} status - New status
     */
    broadcastUserStatus(userId, status) {
        const message = JSON.stringify({
            type: 'userStatus',
            userId,
            status,
            timestamp: new Date().toISOString()
        });

        this.broadcast(message, userId);
    }

    /**
     * Broadcast message to all clients except sender
     * @param {string} message - Message to broadcast
     * @param {string} excludeUserId - User ID to exclude from broadcast
     */
    broadcast(message, excludeUserId = null) {
        this.clients.forEach((client, userId) => {
            if (userId !== excludeUserId && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}

module.exports = WebSocketManager; 