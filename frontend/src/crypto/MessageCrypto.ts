// AES-256-GCM Message Encryption/Decryption

import { base64ToArrayBuffer, arrayBufferToBase64 } from './KeyGenerator';

interface EncryptedMessage {
  ciphertext: string;  // Base64 encoded
  iv: string;          // Base64 encoded (12 bytes)
}

/**
 * Encrypt a message using AES-256-GCM
 */
export async function encryptMessage(
  plaintext: string,
  sharedSecretBase64: string
): Promise<EncryptedMessage> {
  const sharedSecretBuffer = base64ToArrayBuffer(sharedSecretBase64);
  const aesKey = await crypto.subtle.importKey(
    'raw',
    sharedSecretBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintextBytes = new TextEncoder().encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintextBytes
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

/**
 * Decrypt a message using AES-256-GCM
 */
export async function decryptMessage(
  encrypted: EncryptedMessage,
  sharedSecretBase64: string
): Promise<string> {
  const sharedSecretBuffer = base64ToArrayBuffer(sharedSecretBase64);
  const aesKey = await crypto.subtle.importKey(
    'raw',
    sharedSecretBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const iv = new Uint8Array(base64ToArrayBuffer(encrypted.iv));
  const ciphertextBuffer = base64ToArrayBuffer(encrypted.ciphertext);

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertextBuffer
  );

  return new TextDecoder().decode(plaintextBuffer);
}

/**
 * Check if a message object is encrypted
 */
export function isEncryptedMessage(message: any): boolean {
  return message && 
         typeof message.ciphertext === 'string' && 
         typeof message.iv === 'string';
}

export type { EncryptedMessage };