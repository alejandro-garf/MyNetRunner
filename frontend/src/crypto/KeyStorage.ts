// IndexedDB storage for cryptographic keys
// Private keys NEVER leave this device

const DB_NAME = 'mynetrunner-keys';
const DB_VERSION = 1;

interface StoredKeyPair {
  publicKey: string;  // Base64
  privateKey: string; // Base64
}

interface StoredSession {
  recipientId: number;
  sharedSecret: string; // Base64
  createdAt: number;
}

class KeyStorageManager {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store for identity key pair
        if (!db.objectStoreNames.contains('identityKey')) {
          db.createObjectStore('identityKey', { keyPath: 'id' });
        }

        // Store for signed prekeys
        if (!db.objectStoreNames.contains('signedPreKeys')) {
          db.createObjectStore('signedPreKeys', { keyPath: 'keyId' });
        }

        // Store for one-time prekeys
        if (!db.objectStoreNames.contains('oneTimePreKeys')) {
          db.createObjectStore('oneTimePreKeys', { keyPath: 'keyId' });
        }

        // Store for sessions with other users
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'recipientId' });
        }
      };
    });
  }

  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  // Identity Key Pair
  async storeIdentityKeyPair(keyPair: StoredKeyPair): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('identityKey', 'readwrite');
      const store = tx.objectStore('identityKey');
      const request = store.put({ id: 'identity', ...keyPair });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getIdentityKeyPair(): Promise<StoredKeyPair | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('identityKey', 'readonly');
      const store = tx.objectStore('identityKey');
      const request = store.get('identity');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve({ publicKey: result.publicKey, privateKey: result.privateKey });
        } else {
          resolve(null);
        }
      };
    });
  }

  // Signed PreKey
  async storeSignedPreKey(keyId: number, keyPair: StoredKeyPair, signature: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('signedPreKeys', 'readwrite');
      const store = tx.objectStore('signedPreKeys');
      const request = store.put({ keyId, ...keyPair, signature });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getSignedPreKey(keyId: number): Promise<{ publicKey: string; privateKey: string; signature: string } | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('signedPreKeys', 'readonly');
      const store = tx.objectStore('signedPreKeys');
      const request = store.get(keyId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  // One-Time PreKeys
  async storeOneTimePreKey(keyId: number, keyPair: StoredKeyPair): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('oneTimePreKeys', 'readwrite');
      const store = tx.objectStore('oneTimePreKeys');
      const request = store.put({ keyId, ...keyPair });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getOneTimePreKey(keyId: number): Promise<StoredKeyPair | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('oneTimePreKeys', 'readonly');
      const store = tx.objectStore('oneTimePreKeys');
      const request = store.get(keyId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve({ publicKey: result.publicKey, privateKey: result.privateKey });
        } else {
          resolve(null);
        }
      };
    });
  }

  async deleteOneTimePreKey(keyId: number): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('oneTimePreKeys', 'readwrite');
      const store = tx.objectStore('oneTimePreKeys');
      const request = store.delete(keyId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Sessions
  async storeSession(recipientId: number, sharedSecret: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      const store = tx.objectStore('sessions');
      const request = store.put({ recipientId, sharedSecret, createdAt: Date.now() });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getSession(recipientId: number): Promise<StoredSession | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const store = tx.objectStore('sessions');
      const request = store.get(recipientId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async hasSession(recipientId: number): Promise<boolean> {
    const session = await this.getSession(recipientId);
    return session !== null;
  }

  async deleteSession(recipientId: number): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      const store = tx.objectStore('sessions');
      const request = store.delete(recipientId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Clear all keys (for logout)
  async clearAll(): Promise<void> {
    const db = await this.ensureDb();
    const stores = ['identityKey', 'signedPreKeys', 'oneTimePreKeys', 'sessions'];
    
    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    }
  }

  // Check if keys exist
  async hasIdentityKey(): Promise<boolean> {
    const keyPair = await this.getIdentityKeyPair();
    return keyPair !== null;
  }
}

export const keyStorage = new KeyStorageManager();
export type { StoredKeyPair, StoredSession };