// Session Manager - Handles encrypted sessions with other users

import { keyStorage } from './KeyStorage';
import { fetchPreKeyBundle } from './KeyAPI';
import { performX3DHInitiator, verifySignedPreKey } from './X3DH';
import type { PreKeyBundle } from './X3DH';

interface Session {
  recipientId: number;
  recipientUsername: string;
  sharedSecret: string;
  createdAt: number;
}

class SessionManagerClass {
  // Cache of active sessions (also persisted to IndexedDB)
  private sessionCache: Map<number, Session> = new Map();

  /**
   * Get or create a session with another user
   */
  async getOrCreateSession(recipientId: number, recipientUsername?: string): Promise<Session> {
    // Check cache first
    if (this.sessionCache.has(recipientId)) {
      console.log(`Using cached session for user ${recipientId}`);
      return this.sessionCache.get(recipientId)!;
    }

    // Check IndexedDB
    const storedSession = await keyStorage.getSession(recipientId);
    if (storedSession) {
      const session: Session = {
        recipientId: storedSession.recipientId,
        recipientUsername: recipientUsername || `User ${recipientId}`,
        sharedSecret: storedSession.sharedSecret,
        createdAt: storedSession.createdAt,
      };
      this.sessionCache.set(recipientId, session);
      console.log(`Loaded session from storage for user ${recipientId}`);
      return session;
    }

    // No existing session - create new one via X3DH
    console.log(`Creating new session with user ${recipientId}`);
    return await this.createSession(recipientId);
  }

  /**
   * Create a new session with a user via X3DH key exchange
   */
  async createSession(recipientId: number): Promise<Session> {
    // Fetch their prekey bundle from server
    console.log(`Fetching prekey bundle for user ${recipientId}`);
    const bundle = await fetchPreKeyBundle(recipientId);

    // Verify the signed prekey (optional but recommended)
    const isValid = await verifySignedPreKey(
      bundle.identityKey,
      bundle.signedPreKey,
      bundle.signedPreKeySignature
    );

    if (!isValid) {
      console.warn('Signed prekey verification failed - proceeding anyway for demo');
      // In production, you might want to abort here
    } else {
      console.log('Signed prekey verified successfully');
    }

    // Perform X3DH to derive shared secret
    const sharedSecret = await performX3DHInitiator(bundle);

    // Create session object
    const session: Session = {
      recipientId: bundle.userId,
      recipientUsername: bundle.username,
      sharedSecret,
      createdAt: Date.now(),
    };

    // Store in IndexedDB
    await keyStorage.storeSession(recipientId, sharedSecret);

    // Cache it
    this.sessionCache.set(recipientId, session);

    console.log(`Session established with ${bundle.username}`);
    return session;
  }

  /**
   * Check if we have a session with a user
   */
  async hasSession(recipientId: number): Promise<boolean> {
    if (this.sessionCache.has(recipientId)) {
      return true;
    }
    return await keyStorage.hasSession(recipientId);
  }

  /**
   * Get the shared secret for a user (for encryption/decryption)
   */
  async getSharedSecret(recipientId: number): Promise<string | null> {
    const session = await this.getOrCreateSession(recipientId);
    return session?.sharedSecret || null;
  }

  /**
   * Delete a session (e.g., when user wants to reset encryption)
   */
  async deleteSession(recipientId: number): Promise<void> {
    this.sessionCache.delete(recipientId);
    await keyStorage.deleteSession(recipientId);
    console.log(`Session deleted for user ${recipientId}`);
  }

  /**
   * Clear all sessions (for logout)
   */
  async clearAllSessions(): Promise<void> {
    this.sessionCache.clear();
    // IndexedDB sessions are cleared by keyStorage.clearAll()
    console.log('All sessions cleared');
  }
}

export const sessionManager = new SessionManagerClass();
export type { Session };