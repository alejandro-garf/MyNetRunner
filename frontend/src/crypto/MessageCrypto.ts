// AES-256-GCM Message Encryption/Decryption with Padding

import { base64ToArrayBuffer, arrayBufferToBase64 } from './KeyGenerator';

interface EncryptedMessage {
  ciphertext: string;
  iv: string;
}

// All messages padded to 4KB (hides actual message length)
const PADDED_SIZE = 4096;

// Pad message to fixed size
function padMessage(plaintext: string): ArrayBuffer {
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(plaintext);

  const maxMessageSize = PADDED_SIZE - 4;

  if (messageBytes.length > maxMessageSize) {
    throw new Error(`Message too long (max ${maxMessageSize} bytes)`);
  }

  const padded = new Uint8Array(PADDED_SIZE);

  // First 4 bytes: message length (little-endian)
  padded[0] = messageBytes.length & 0xff;
  padded[1] = (messageBytes.length >> 8) & 0xff;
  padded[2] = (messageBytes.length >> 16) & 0xff;
  padded[3] = (messageBytes.length >> 24) & 0xff;

  // Copy message after length prefix
  padded.set(messageBytes, 4);

  // Fill rest with random bytes
  const randomPadding = crypto.getRandomValues(new Uint8Array(PADDED_SIZE - 4 - messageBytes.length));
  padded.set(randomPadding, 4 + messageBytes.length);

  return padded.buffer as ArrayBuffer;
}

// Remove padding and extract original message
function unpadMessage(padded: ArrayBuffer): string {
  const bytes = new Uint8Array(padded);
  
  // Read length from first 4 bytes
  const messageLength = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);

  // Validate length
  if (messageLength < 0 || messageLength > PADDED_SIZE - 4) {
    throw new Error('Invalid message length');
  }

  // Extract message bytes
  const messageBytes = bytes.slice(4, 4 + messageLength);

  const decoder = new TextDecoder();
  return decoder.decode(messageBytes);
}

/**
 * Encrypt a message using AES-256-GCM with fixed-size padding
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

  // Generate random 12-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Pad message to fixed size before encryption
  const paddedMessage = padMessage(plaintext);

  // Encrypt
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    paddedMessage
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt a message using AES-256-GCM and remove padding
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

  // Decrypt
  const paddedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertextBuffer
  );

  // Remove padding and return original message
  return unpadMessage(paddedBuffer);
}

/**
 * Check if a message object is encrypted
 */
export function isEncryptedMessage(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    'ciphertext' in message &&
    'iv' in message &&
    typeof (message as EncryptedMessage).ciphertext === 'string' &&
    typeof (message as EncryptedMessage).iv === 'string'
  );
}

export type { EncryptedMessage };