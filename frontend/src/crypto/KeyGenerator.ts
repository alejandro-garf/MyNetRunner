// Key generation using libsignal curves + Web Crypto

import { keyStorage } from './KeyStorage';

// Helper: Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate a key pair using Web Crypto (ECDH with P-256)
async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );

  const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  return {
    publicKey: arrayBufferToBase64(publicKeyBuffer),
    privateKey: arrayBufferToBase64(privateKeyBuffer),
  };
}

// Sign data with ECDSA
async function signData(privateKeyBase64: string, data: ArrayBuffer): Promise<string> {
  const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);
  
  // Import as ECDSA key for signing
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    data
  );

  return arrayBufferToBase64(signature);
}

// Generate identity key pair (long-term)
export async function generateIdentityKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await generateKeyPair();
  await keyStorage.storeIdentityKeyPair(keyPair);
  return keyPair;
}

// Generate signed prekey
export async function generateSignedPreKey(
  identityPrivateKey: string,
  keyId: number
): Promise<{ publicKey: string; privateKey: string; signature: string; keyId: number }> {
  const keyPair = await generateKeyPair();
  
  // Sign the public key with our identity key
  const publicKeyBuffer = base64ToArrayBuffer(keyPair.publicKey);
  const signature = await signData(identityPrivateKey, publicKeyBuffer);

  await keyStorage.storeSignedPreKey(keyId, keyPair, signature);

  return {
    ...keyPair,
    signature,
    keyId,
  };
}

// Generate multiple one-time prekeys
export async function generateOneTimePreKeys(
  startId: number,
  count: number
): Promise<Array<{ publicKey: string; keyId: number }>> {
  const preKeys: Array<{ publicKey: string; keyId: number }> = [];

  for (let i = 0; i < count; i++) {
    const keyId = startId + i;
    const keyPair = await generateKeyPair();
    await keyStorage.storeOneTimePreKey(keyId, keyPair);
    preKeys.push({ publicKey: keyPair.publicKey, keyId });
  }

  return preKeys;
}

// Generate complete registration bundle
export async function generateRegistrationBundle(): Promise<{
  identityKey: string;
  signedPreKey: string;
  signedPreKeyId: number;
  signedPreKeySignature: string;
  oneTimePreKeys: Array<{ keyId: number; publicKey: string }>;
}> {
  // Generate identity key
  const identityKeyPair = await generateIdentityKeyPair();

  // Generate signed prekey (ID = 1)
  const signedPreKey = await generateSignedPreKey(identityKeyPair.privateKey, 1);

  // Generate 10 one-time prekeys (IDs 1-10)
  const oneTimePreKeys = await generateOneTimePreKeys(1, 10);

  return {
    identityKey: identityKeyPair.publicKey,
    signedPreKey: signedPreKey.publicKey,
    signedPreKeyId: signedPreKey.keyId,
    signedPreKeySignature: signedPreKey.signature,
    oneTimePreKeys: oneTimePreKeys.map((k) => ({ keyId: k.keyId, publicKey: k.publicKey })),
  };
}

// Check if user has generated keys
export async function hasGeneratedKeys(): Promise<boolean> {
  return await keyStorage.hasIdentityKey();
}

export { arrayBufferToBase64, base64ToArrayBuffer };