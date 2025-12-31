import SockJS from 'sockjs-client';
import { Client, IMessage } from '@stomp/stompjs';
import type { Message } from '../types';
import { getToken, authAPI, api } from './api';
import { sessionManager } from '../crypto/SessionManager';
import { encryptMessage, decryptMessage } from '../crypto/MessageCrypto';
import { keyStorage } from '../crypto/KeyStorage';

export class ChatWebSocket {
  private stompClient: Client | null = null;
  private url: string;
  private connected: boolean = false;
  private messageCallback: ((message: Message) => void) | null = null;
  private errorCallback: ((error: string) => void) | null = null;
  private presenceCallback: ((presence: { username: string; online: boolean }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(
    onMessage: (message: Message) => void,
    onError?: (error: string) => void,
    onPresence?: (presence: { username: string; online: boolean }) => void
  ): void {
    this.messageCallback = onMessage;
    this.errorCallback = onError || null;
    this.presenceCallback = onPresence || null;

    const token = getToken();

    if (!token) {
      if (this.errorCallback) {
        this.errorCallback('Not authenticated');
      }
      return;
    }

    try {
      const socket = new SockJS(this.url);

      this.stompClient = new Client({
        webSocketFactory: () => socket as any,
        debug: () => {},
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        connectHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });

      this.stompClient.onConnect = () => {
        this.connected = true;

        // Fetch pending messages on connect
        this.fetchPendingMessages();

        if (this.stompClient) {
          // Subscribe to personal message queue
          this.stompClient.subscribe('/user/queue/messages', async (message: IMessage) => {
            try {
              const receivedMessage = JSON.parse(message.body);
              await this.processIncomingMessage(receivedMessage);
            } catch (error) {
              if (this.errorCallback) {
                this.errorCallback('Failed to parse message');
              }
            }
          });

          // Subscribe to presence updates
          this.stompClient.subscribe('/topic/presence', (message: IMessage) => {
            try {
              const presenceUpdate = JSON.parse(message.body);

              if (this.presenceCallback) {
                this.presenceCallback(presenceUpdate);
              }
            } catch (error) {
              // Failed to parse presence update
            }
          });

          // Subscribe to errors
          this.stompClient.subscribe('/user/queue/errors', (message: IMessage) => {
            try {
              const error = JSON.parse(message.body);
              if (this.errorCallback) {
                this.errorCallback(error.error || 'Server error');
              }
            } catch (error) {
              // Failed to parse error
            }
          });
        }
      };

      this.stompClient.onStompError = (frame) => {
        this.connected = false;

        const errorMessage = frame.headers?.message || 'Connection error';
        if (
          errorMessage.includes('token') ||
          errorMessage.includes('Authorization') ||
          errorMessage.includes('auth')
        ) {
          this.handleAuthError();
        } else if (this.errorCallback) {
          this.errorCallback(errorMessage);
        }
      };

      this.stompClient.onWebSocketError = (_event) => {
        this.connected = false;
        if (this.errorCallback) {
          this.errorCallback('WebSocket connection error');
        }
      };

      this.stompClient.onDisconnect = () => {
        this.connected = false;
      };

      this.stompClient.activate();
    } catch (error) {
      if (this.errorCallback) {
        this.errorCallback('Failed to connect');
      }
    }
  }

  private async fetchPendingMessages(): Promise<void> {
    try {
      const response = await api.get('/api/messages/pending');
      const messages = response.data.messages || [];

      for (const msg of messages) {
        await this.processIncomingMessage(msg);
      }
    } catch (error) {
      // Failed to fetch pending messages
    }
  }

  private async processIncomingMessage(receivedMessage: any): Promise<void> {
    // Generate timestamp if not present
    if (!receivedMessage.timestamp) {
      receivedMessage.timestamp = new Date().toISOString();
    }

    // Check if message is encrypted
    if (receivedMessage.encryptedContent && receivedMessage.iv) {
      try {
        const senderId = receivedMessage.senderId;
        let sharedSecret: any = null;

        // If message has key exchange data, ALWAYS create a new responder session
        // This ensures we use the sender's current ephemeral key
        if (receivedMessage.senderIdentityKey && receivedMessage.senderEphemeralKey) {
          const session = await sessionManager.createResponderSession(
            senderId,
            receivedMessage.senderUsername,
            receivedMessage.senderIdentityKey,
            receivedMessage.senderEphemeralKey,
            receivedMessage.usedOneTimePreKeyId || null
          );
          sharedSecret = session.sharedSecret;
        } else {
          // No key exchange data - try to use existing session (shouldn't happen with new logic)
          sharedSecret = await sessionManager.getSharedSecret(senderId);
        }

        if (sharedSecret) {
          const decryptedContent = await decryptMessage(
            {
              ciphertext: receivedMessage.encryptedContent,
              iv: receivedMessage.iv,
            },
            sharedSecret
          );

          receivedMessage.content = decryptedContent;
          receivedMessage.isEncrypted = true;
        } else {
          receivedMessage.content = '[Unable to decrypt - no session]';
        }
      } catch (decryptError) {
        receivedMessage.content = '[Decryption failed]';
      }
    }

    if (this.messageCallback) {
      this.messageCallback(receivedMessage);
    }
  }

  private async handleAuthError(): Promise<void> {
    const newToken = await authAPI.refreshToken();

    if (newToken) {
      this.disconnect();
      if (this.messageCallback) {
        this.connect(
          this.messageCallback,
          this.errorCallback || undefined,
          this.presenceCallback || undefined
        );
      }
    } else {
      if (this.errorCallback) {
        this.errorCallback('Authentication failed. Please log in again.');
      }
    }
  }

  async sendChatMessage(
    senderUsername: string,
    recipientUsername: string,
    recipientId: number,
    content: string,
    ttlMinutes: number = 5
  ): Promise<void> {
    if (!this.stompClient || !this.connected) {
      return;
    }

    try {
      // ALWAYS create a fresh session for EVERY message
      // This fetches the recipient's CURRENT keys from the server
      // and ensures key exchange data is always included
      const initiatorSession = await sessionManager.createInitiatorSession(recipientId);

      const identityKeyPair = await keyStorage.getIdentityKeyPair();
      const senderIdentityKey = identityKeyPair?.publicKey || null;
      const senderEphemeralKey = initiatorSession.ephemeralPublicKey;
      const usedOneTimePreKeyId = initiatorSession.usedOneTimePreKeyId;

      const encrypted = await encryptMessage(content, initiatorSession.sharedSecret);

      const messageRequest: any = {
        senderUsername: senderUsername,
        recipientUsername: recipientUsername,
        content: '',
        encryptedContent: encrypted.ciphertext,
        iv: encrypted.iv,
        isEncrypted: true,
        ttlMinutes: ttlMinutes,
        // ALWAYS include key exchange data
        senderIdentityKey: senderIdentityKey,
        senderEphemeralKey: senderEphemeralKey,
        usedOneTimePreKeyId: usedOneTimePreKeyId,
      };

      this.stompClient.publish({
        destination: '/app/send',
        body: JSON.stringify(messageRequest),
      });
    } catch (error) {
      // Fallback to unencrypted (for debugging only)
      const messageRequest = {
        senderUsername: senderUsername,
        recipientUsername: recipientUsername,
        content: content,
        isEncrypted: false,
        ttlMinutes: ttlMinutes,
      };

      this.stompClient.publish({
        destination: '/app/send',
        body: JSON.stringify(messageRequest),
      });
    }
  }

  async sendGroupMessage(
    senderUsername: string,
    groupId: number,
    content: string,
    ttlMinutes: number = 5
  ): Promise<void> {
    if (!this.stompClient || !this.connected) {
      return;
    }

    const messageRequest = {
      senderUsername: senderUsername,
      groupId: groupId,
      content: content,
      isEncrypted: false,
      ttlMinutes: ttlMinutes,
    };

    this.stompClient.publish({
      destination: '/app/send-group',
      body: JSON.stringify(messageRequest),
    });
  }

  disconnect(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

let chatWebSocket: ChatWebSocket | null = null;

export const getChatWebSocket = (): ChatWebSocket | null => {
  return chatWebSocket;
};

export const initializeChatWebSocket = (url: string): ChatWebSocket => {
  if (chatWebSocket) {
    chatWebSocket.disconnect();
  }

  chatWebSocket = new ChatWebSocket(url);
  return chatWebSocket;
};

export const disconnectChatWebSocket = (): void => {
  if (chatWebSocket) {
    chatWebSocket.disconnect();
    chatWebSocket = null;
  }
};