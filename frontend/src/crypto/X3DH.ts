// X3DH (Extended Triple Diffie-Hellman) Key Exchange
// Derives a shared secret between two users without ever transmitting it

import { keyStorage } from './KeyStorage';
import { base64ToArrayBuffer, arrayBufferToBase64 } from './KeyGenerator';

interface PreKeyBundle {
  userId: number;
  username: string;
  identityKey: string;
  signedPreKey: string;
  signedPreKeyId: number;
  signedPreKeySignature: string;
  oneTimePreKeyId: number | null;
  oneTimePreKey: string | null;
}

// Import a public key from base64 SPKI format
async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(base64Key);
  return await crypto.subtle.importKey(
    'spki',
    keyBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

// Import a private key from base64 PKCS8 format
async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(base64Key);
  return await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// Perform ECDH to derive shared bits
async function performDH(privateKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer> {
  return await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256 // 256 bits = 32 bytes
  );
}

// Combine multiple DH results using HKDF
async function kdf(inputs: ArrayBuffer[]): Promise<ArrayBuffer> {
  // Concatenate all inputs
  const totalLength = inputs.reduce((sum, buf) => sum + buf.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const input of inputs) {
    combined.set(new Uint8Array(input), offset);
    offset += input.byteLength;
  }

  // Import as HKDF key
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    combined,
    'HKDF',
    false,
    ['deriveBits']
  );

  // Derive final key material
  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32), // Zero salt for simplicity
      info: new TextEncoder().encode('MyNetRunner-X3DH'),
    },
    hkdfKey,
    256 // 256 bits = 32 bytes
  );

  return sharedSecret;
}

// Generate an ephemeral key pair for this session
async function generateEphemeralKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Perform X3DH key exchange as the initiator (person starting the conversation)
 * 
 * @param theirBundle - The recipient's prekey bundle from the server
 * @returns The derived shared secret (base64)
 */
export async function performX3DHInitiator(theirBundle: PreKeyBundle): Promise<string> {
  console.log('Performing X3DH key exchange with:', theirBundle.username);

  // Get our identity key pair
  const ourIdentity = await keyStorage.getIdentityKeyPair();
  if (!ourIdentity) {
    throw new Error('No identity key found. Please log in again.');
  }

  // Import our private identity key
  const ourIdentityPrivate = await importPrivateKey(ourIdentity.privateKey);

  // Import their public keys
  const theirIdentityPublic = await importPublicKey(theirBundle.identityKey);
  const theirSignedPreKeyPublic = await importPublicKey(theirBundle.signedPreKey);

  // Generate ephemeral key pair for this session
  const ephemeralKeyPair = await generateEphemeralKeyPair();

  // Perform the DH operations:
  // DH1: Our identity private + Their signed prekey public
  const dh1 = await performDH(ourIdentityPrivate, theirSignedPreKeyPublic);
  console.log('DH1 complete');

  // DH2: Our ephemeral private + Their identity public
  const dh2 = await performDH(ephemeralKeyPair.privateKey, theirIdentityPublic);
  console.log('DH2 complete');

  // DH3: Our ephemeral private + Their signed prekey public
  const dh3 = await performDH(ephemeralKeyPair.privateKey, theirSignedPreKeyPublic);
  console.log('DH3 complete');

  // Collect DH results
  const dhResults = [dh1, dh2, dh3];

  // DH4 (optional): If they have a one-time prekey, use it for extra security
  if (theirBundle.oneTimePreKey) {
    const theirOneTimePreKeyPublic = await importPublicKey(theirBundle.oneTimePreKey);
    const dh4 = await performDH(ephemeralKeyPair.privateKey, theirOneTimePreKeyPublic);
    dhResults.push(dh4);
    console.log('DH4 complete (with one-time prekey)');
  }

  // Derive the shared secret using KDF
  const sharedSecret = await kdf(dhResults);
  console.log('Shared secret derived');

  // Return as base64
  return arrayBufferToBase64(sharedSecret);
}

/**
 * Verify a signed prekey signature (optional but recommended)
 */
export async function verifySignedPreKey(
  identityKey: string,
  signedPreKey: string,
  signature: string
): Promise<boolean> {
  try {
    const identityKeyBuffer = base64ToArrayBuffer(identityKey);
    
    // Import identity key for verification (ECDSA)
    const verifyKey = await crypto.subtle.importKey(
      'spki',
      identityKeyBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );

    const signedPreKeyBuffer = base64ToArrayBuffer(signedPreKey);
    const signatureBuffer = base64ToArrayBuffer(signature);

    const isValid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verifyKey,
      signatureBuffer,
      signedPreKeyBuffer
    );

    return isValid;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

export type { PreKeyBundle };