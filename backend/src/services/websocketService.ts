import WebSocket, { Server as WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { Server as HTTPServer } from 'http';
import logger from '../config/logger';
import chatService from './chatService';
import db from '../config/database';

interface CustomWebSocket extends WebSocket {
  userId?: string;
  role?: string;
  isAuthenticated?: boolean;
  conversationId?: string;
}

interface MessagePayload {
  token?: string;
  conversationId?: string;
  content?: string;
  notificationId?: string;
  [key: string]: unknown;
}

interface WebSocketMessage {
  type: string;
  payload: MessagePayload;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<CustomWebSocket>> = new Map(); // conversationId -> Set of WebSocket connections
  private professionalClients: Map<string, CustomWebSocket> = new Map(); // userId -> WebSocket connection

  initialize(server: HTTPServer): void {
    this.wss = new WebSocket.Server({ server, path: '/ws' });

    this.wss.on('connection', (ws: CustomWebSocket, _req: unknown) => {
      logger.info('New WebSocket connection');

      ws.on('message', async (message: WebSocket.Data) => {
        try {
          const data: WebSocketMessage = JSON.parse(message.toString());
          await this.handleMessage(ws, data);
        } catch (error) {
          logger.error('WebSocket message error:', error);
          ws.send(JSON.stringify({ type: 'error', message: (error as Error).message }));
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error: Error) => {
        logger.error('WebSocket error:', error);
      });
    });

    logger.info('WebSocket server initialized');
  }

  async handleMessage(ws: CustomWebSocket, data: WebSocketMessage): Promise<void> {
    const { type, payload } = data;

    switch (type) {
      case 'authenticate':
        await this.handleAuthentication(ws, payload);
        break;

      case 'join_conversation':
        await this.handleJoinConversation(ws, payload);
        break;

      case 'send_message':
        await this.handleSendMessage(ws, payload);
        break;

      case 'professional_takeover':
        await this.handleProfessionalTakeover(ws, payload);
        break;

      case 'professional_message':
        await this.handleProfessionalMessage(ws, payload);
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  }

  async handleAuthentication(ws: CustomWebSocket, payload: MessagePayload): Promise<void> {
    try {
      const { token, conversationId } = payload;

      if (token) {
        // Professional authentication
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string; role: string };
        ws.userId = decoded.userId;
        ws.role = decoded.role;
        ws.isAuthenticated = true;

        this.professionalClients.set(decoded.userId, ws);

        ws.send(JSON.stringify({
          type: 'authenticated',
          payload: { role: 'professional', userId: decoded.userId },
        }));

        logger.info(`Professional ${decoded.userId} authenticated`);
      } else if (conversationId) {
        // End-user joining conversation
        ws.conversationId = conversationId;
        ws.role = 'end_user';

        if (!this.clients.has(conversationId)) {
          this.clients.set(conversationId, new Set());
        }
        this.clients.get(conversationId)!.add(ws);

        ws.send(JSON.stringify({
          type: 'joined_conversation',
          payload: { conversationId },
        }));

        logger.info(`End-user joined conversation ${conversationId}`);
      }
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
    }
  }

  async handleJoinConversation(ws: CustomWebSocket, payload: MessagePayload): Promise<void> {
    const { conversationId } = payload;

    if (conversationId) {
      if (!this.clients.has(conversationId)) {
        this.clients.set(conversationId, new Set());
      }
      this.clients.get(conversationId)!.add(ws);

      ws.conversationId = conversationId;

      ws.send(JSON.stringify({
        type: 'joined_conversation',
        payload: { conversationId },
      }));
    }
  }

  async handleSendMessage(ws: CustomWebSocket, payload: MessagePayload): Promise<void> {
    try {
      const { conversationId, content } = payload;

      if (!conversationId || !content) {
        throw new Error('Missing conversationId or content');
      }

      // Save message
      const userMessage = await chatService.sendMessage(conversationId, 'user', content);

      // Broadcast to all clients in this conversation
      this.broadcastToConversation(conversationId, {
        type: 'new_message',
        payload: userMessage,
      });

      // Generate a unique message ID for streaming
      const streamingMessageId = `streaming_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Notify clients that streaming is starting
      this.broadcastToConversation(conversationId, {
        type: 'streaming_start',
        payload: {
          messageId: streamingMessageId,
          sender: 'twin',
        },
      });

      // Generate twin response with streaming
      const twinResponse = await chatService.generateTwinResponseStreaming(
        conversationId,
        userMessage.content,
        async (chunk: string) => {
          // Send each chunk to all clients
          this.broadcastToConversation(conversationId, {
            type: 'streaming_chunk',
            payload: {
              messageId: streamingMessageId,
              chunk,
            },
          });
        }
      );

      // Notify clients that streaming is complete
      this.broadcastToConversation(conversationId, {
        type: 'streaming_end',
        payload: {
          messageId: streamingMessageId,
          message: twinResponse.message,
        },
      });

      // If handover triggered, notify professional
      if (twinResponse.handoverTriggered) {
        await this.notifyProfessionalHandover(conversationId, twinResponse.reason || '');
      }
    } catch (error) {
      logger.error('Send message error:', error);
      ws.send(JSON.stringify({ type: 'error', message: (error as Error).message }));
    }
  }

  async handleProfessionalTakeover(ws: CustomWebSocket, payload: MessagePayload): Promise<void> {
    try {
      const { conversationId, notificationId } = payload;

      if (!ws.isAuthenticated || ws.role !== 'professional') {
        ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
        return;
      }

      if (!conversationId || !notificationId || !ws.userId) {
        throw new Error('Missing required fields');
      }

      // Accept handover
      await chatService.acceptHandover(notificationId, ws.userId);

      // Join conversation
      if (!this.clients.has(conversationId)) {
        this.clients.set(conversationId, new Set());
      }
      this.clients.get(conversationId)!.add(ws);
      ws.conversationId = conversationId;

      // Notify end-user
      this.broadcastToConversation(conversationId, {
        type: 'professional_joined',
        payload: { message: 'A professional has joined the conversation' },
      }, ws);

      ws.send(JSON.stringify({
        type: 'takeover_successful',
        payload: { conversationId },
      }));

      logger.info(`Professional ${ws.userId} took over conversation ${conversationId}`);
    } catch (error) {
      logger.error('Professional takeover error:', error);
      ws.send(JSON.stringify({ type: 'error', message: (error as Error).message }));
    }
  }

  async handleProfessionalMessage(ws: CustomWebSocket, payload: MessagePayload): Promise<void> {
    try {
      const { conversationId, content } = payload;

      if (!ws.isAuthenticated || ws.role !== 'professional') {
        ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
        return;
      }

      if (!conversationId || !content) {
        throw new Error('Missing conversationId or content');
      }

      // Save message
      const message = await chatService.sendMessage(conversationId, 'professional', content);

      // Broadcast to all clients in this conversation
      this.broadcastToConversation(conversationId, {
        type: 'new_message',
        payload: message,
      });
    } catch (error) {
      logger.error('Professional message error:', error);
      ws.send(JSON.stringify({ type: 'error', message: (error as Error).message }));
    }
  }

  async notifyProfessionalHandover(conversationId: string, reason: string): Promise<void> {
    try {
      // Get conversation details
      const result = await db.query(
        `SELECT dt.user_id FROM conversations c
         JOIN digital_twins dt ON c.twin_id = dt.id
         WHERE c.id = $1`,
        [conversationId]
      );

      if (result.rows.length === 0) return;

      const userId = result.rows[0].user_id;
      const professionalWs = this.professionalClients.get(userId);

      if (professionalWs && professionalWs.readyState === WebSocket.OPEN) {
        professionalWs.send(JSON.stringify({
          type: 'handover_notification',
          payload: {
            conversationId,
            reason,
            message: 'A conversation needs your attention',
          },
        }));

        logger.info(`Handover notification sent to professional ${userId}`);
      }
    } catch (error) {
      logger.error('Notify professional handover error:', error);
    }
  }

  broadcastToConversation(conversationId: string, message: Record<string, unknown>, excludeWs: CustomWebSocket | null = null): void {
    const clients = this.clients.get(conversationId);
    if (!clients) return;

    const messageStr = JSON.stringify(message);

    clients.forEach((client) => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  handleDisconnect(ws: CustomWebSocket): void {
    // Remove from conversation clients
    if (ws.conversationId) {
      const clients = this.clients.get(ws.conversationId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          this.clients.delete(ws.conversationId);
        }
      }
    }

    // Remove from professional clients
    if (ws.userId) {
      this.professionalClients.delete(ws.userId);
    }

    logger.info('WebSocket client disconnected');
  }
}

export default new WebSocketService();
