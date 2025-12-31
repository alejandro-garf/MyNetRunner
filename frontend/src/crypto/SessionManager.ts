// Session Manager - Handles encrypted sessions with other users

import { keyStorage } from './KeyStorage';
import { fetchPreKeyBundle } from './KeyAPI';
import { performX3DHInitiator, performX3DHResponder, verifySignedPreKey } from './X3DH';
import type { X3DHResult } from './X3DH';

interface Session {
  recipientId: number;
  recipientUsername: string;
  sharedSecret: string;
  createdAt: number;
}

interface InitiatorSession extends Session {
  ephemeralPublicKey: string;
  usedOneTimePreKeyId: number | null;
}

class SessionManagerClass {

  /**
   * Get existing session from IndexedDB (does NOT create new one)
   */
  async getSession(recipientId: number): Promise<Session | null> {
    const storedSession = await keyStorage.getSession(recipientId);
    if (storedSession) {
      return {
        recipientId: storedSession.recipientId,
        recipientUsername: `User ${recipientId}`,
        sharedSecret: storedSession.sharedSecret,
        createdAt: storedSession.createdAt,
      };
    }
    return null;
  }

  /**
   * Create a new session as INITIATOR (starting conversation)
   */
  async createInitiatorSession(recipientId: number): Promise<InitiatorSession> {
    const bundle = await fetchPreKeyBundle(recipientId);

    await verifySignedPreKey(
      bundle.identityKey,
      bundle.signedPreKey,
      bundle.signedPreKeySignature
    );

    const x3dhResult: X3DHResult = await performX3DHInitiator(bundle);

    const session: InitiatorSession = {
      recipientId: bundle.userId,
      recipientUsername: bundle.username,
      sharedSecret: x3dhResult.sharedSecret,
      ephemeralPublicKey: x3dhResult.ephemeralPublicKey,
      usedOneTimePreKeyId: x3dhResult.usedOneTimePreKeyId,
      createdAt: Date.now(),
    };

    await keyStorage.storeSession(recipientId, x3dhResult.sharedSecret);

    return session;
  }

  /**
   * Create a session as RESPONDER (receiving first message)
   */
  async createResponderSession(
    senderId: number,
    senderUsername: string,
    senderIdentityKey: string,
    senderEphemeralKey: string,
    usedOneTimePreKeyId: number | null
  ): Promise<Session> {
    const sharedSecret = await performX3DHResponder(
      senderIdentityKey,
      senderEphemeralKey,
      usedOneTimePreKeyId
    );

    const session: Session = {
      recipientId: senderId,
      recipientUsername: senderUsername,
      sharedSecret,
      createdAt: Date.now(),
    };

    await keyStorage.storeSession(senderId, sharedSecret);

    return session;
  }

  /**
   * Get shared secret for encryption/decryption
   */
  async getSharedSecret(recipientId: number): Promise<string | null> {
    const session = await this.getSession(recipientId);
    return session?.sharedSecret || null;
  }

  /**
   * Check if session exists
   */
  async hasSession(recipientId: number): Promise<boolean> {
    return await keyStorage.hasSession(recipientId);
  }

  /**
   * Delete a session
   */
  async deleteSession(recipientId: number): Promise<void> {
    await keyStorage.deleteSession(recipientId);
  }
}

export const sessionManager = new SessionManagerClass();
export type { Session, InitiatorSession };