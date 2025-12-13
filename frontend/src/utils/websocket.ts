import SockJS from 'sockjs-client';
import { Client, IMessage } from '@stomp/stompjs';
import type { Message } from '../types';
import { getToken, authAPI } from './api';
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
      console.error('No auth token available');
      if (this.errorCallback) {
        this.errorCallback('Not authenticated');
      }
      return;
    }

    try {
      const socket = new SockJS(this.url);

      this.stompClient = new Client({
        webSocketFactory: () => socket as any,
        debug: (str) => {
          console.log('STOMP Debug:', str);
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        connectHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });

      this.stompClient.onConnect = () => {
        console.log('STOMP WebSocket connected');
        this.connected = true;

        if (this.stompClient) {
          // Subscribe to personal message queue
          this.stompClient.subscribe('/user/queue/messages', async (message: IMessage) => {
            try {
              const receivedMessage = JSON.parse(message.body);

              // Check if message is encrypted
              if (receivedMessage.encryptedContent && receivedMessage.iv) {
                try {
                  const senderId = receivedMessage.senderId;
                  let sharedSecret = await sessionManager.getSharedSecret(senderId);

                  // If no session exists and we have key exchange data, create responder session
                  if (!sharedSecret && receivedMessage.senderIdentityKey && receivedMessage.senderEphemeralKey) {
                    const session = await sessionManager.createResponderSession(
                      senderId,
                      receivedMessage.senderUsername,
                      receivedMessage.senderIdentityKey,
                      receivedMessage.senderEphemeralKey,
                      receivedMessage.usedOneTimePreKeyId || null
                    );
                    sharedSecret = session.sharedSecret;
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
                  console.error('Decryption failed:', decryptError);
                  receivedMessage.content = '[Decryption failed]';
                }
              }

              if (this.messageCallback) {
                this.messageCallback(receivedMessage);
              }
            } catch (error) {
              console.error('Failed to parse message:', error);
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
              console.error('Failed to parse presence update:', error);
            }
          });

          // Subscribe to errors
          this.stompClient.subscribe('/user/queue/errors', (message: IMessage) => {
            try {
              const error = JSON.parse(message.body);
              console.error('Server error:', error);
              if (this.errorCallback) {
                this.errorCallback(error.error || 'Server error');
              }
            } catch (error) {
              console.error('Failed to parse error:', error);
            }
          });
        }
      };

      this.stompClient.onStompError = (frame) => {
        console.error('STOMP error:', frame);
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

      this.stompClient.onWebSocketError = (event) => {
        console.error('WebSocket error:', event);
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
      console.error('Failed to create WebSocket connection:', error);
      if (this.errorCallback) {
        this.errorCallback('Failed to connect');
      }
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
      console.warn('WebSocket is not connected, cannot send message');
      return;
    }

    try {
      let session = await sessionManager.getSession(recipientId);
      let senderIdentityKey: string | null = null;
      let senderEphemeralKey: string | null = null;
      let usedOneTimePreKeyId: number | null = null;

      if (!session) {
        const initiatorSession = await sessionManager.createInitiatorSession(recipientId);
        session = initiatorSession;

        const identityKeyPair = await keyStorage.getIdentityKeyPair();
        senderIdentityKey = identityKeyPair?.publicKey || null;
        senderEphemeralKey = initiatorSession.ephemeralPublicKey;
        usedOneTimePreKeyId = initiatorSession.usedOneTimePreKeyId;
      }

      const encrypted = await encryptMessage(content, session.sharedSecret);

      const messageRequest: any = {
        senderUsername: senderUsername,
        recipientUsername: recipientUsername,
        content: '',
        encryptedContent: encrypted.ciphertext,
        iv: encrypted.iv,
        isEncrypted: true,
        ttlMinutes: ttlMinutes,
      };

      if (senderIdentityKey && senderEphemeralKey) {
        messageRequest.senderIdentityKey = senderIdentityKey;
        messageRequest.senderEphemeralKey = senderEphemeralKey;
        messageRequest.usedOneTimePreKeyId = usedOneTimePreKeyId;
      }

      this.stompClient.publish({
        destination: '/app/send',
        body: JSON.stringify(messageRequest),
      });
    } catch (error) {
      console.error('Failed to send encrypted message:', error);

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
      console.warn('WebSocket is not connected, cannot send message');
      return;
    }

    // For group messages, we send unencrypted for now
    // Full group E2E would require sender keys (complex)
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