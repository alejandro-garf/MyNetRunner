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

interface X3DHResult {
  sharedSecret: string;
  ephemeralPublicKey: string;
  usedOneTimePreKeyId: number | null;
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
    256
  );
}

// Combine multiple DH results using HKDF
async function kdf(inputs: ArrayBuffer[]): Promise<ArrayBuffer> {
  const totalLength = inputs.reduce((sum, buf) => sum + buf.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const input of inputs) {
    combined.set(new Uint8Array(input), offset);
    offset += input.byteLength;
  }

  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    combined,
    'HKDF',
    false,
    ['deriveBits']
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: new TextEncoder().encode('MyNetRunner-X3DH'),
    },
    hkdfKey,
    256
  );

  return sharedSecret;
}

// Generate an ephemeral key pair for this session
async function generateEphemeralKeyPair(): Promise<{ publicKey: string; privateKey: CryptoKey }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);

  return {
    publicKey: arrayBufferToBase64(publicKeyBuffer),
    privateKey: keyPair.privateKey,
  };
}

/**
 * Perform X3DH as INITIATOR (person starting the conversation)
 */
export async function performX3DHInitiator(theirBundle: PreKeyBundle): Promise<X3DHResult> {
  const ourIdentity = await keyStorage.getIdentityKeyPair();
  if (!ourIdentity) {
    throw new Error('No identity key found. Please log in again.');
  }

  const ourIdentityPrivate = await importPrivateKey(ourIdentity.privateKey);
  const theirIdentityPublic = await importPublicKey(theirBundle.identityKey);
  const theirSignedPreKeyPublic = await importPublicKey(theirBundle.signedPreKey);

  // Generate ephemeral key pair
  const ephemeral = await generateEphemeralKeyPair();

  // DH1: Our identity private + Their signed prekey public
  const dh1 = await performDH(ourIdentityPrivate, theirSignedPreKeyPublic);

  // DH2: Our ephemeral private + Their identity public
  const dh2 = await performDH(ephemeral.privateKey, theirIdentityPublic);

  // DH3: Our ephemeral private + Their signed prekey public
  const dh3 = await performDH(ephemeral.privateKey, theirSignedPreKeyPublic);

  const dhResults = [dh1, dh2, dh3];
  let usedOneTimePreKeyId: number | null = null;

  // DH4 (optional): One-time prekey
  if (theirBundle.oneTimePreKey && theirBundle.oneTimePreKeyId) {
    const theirOneTimePreKeyPublic = await importPublicKey(theirBundle.oneTimePreKey);
    const dh4 = await performDH(ephemeral.privateKey, theirOneTimePreKeyPublic);
    dhResults.push(dh4);
    usedOneTimePreKeyId = theirBundle.oneTimePreKeyId;
  }

  const sharedSecret = await kdf(dhResults);

  return {
    sharedSecret: arrayBufferToBase64(sharedSecret),
    ephemeralPublicKey: ephemeral.publicKey,
    usedOneTimePreKeyId,
  };
}

/**
 * Perform X3DH as RESPONDER (person receiving the first message)
 */
export async function performX3DHResponder(
  senderIdentityKey: string,
  senderEphemeralKey: string,
  usedOneTimePreKeyId: number | null
): Promise<string> {
  // Get our keys
  const ourIdentity = await keyStorage.getIdentityKeyPair();
  if (!ourIdentity) {
    throw new Error('No identity key found. Please log in again.');
  }

  const signedPreKey = await keyStorage.getSignedPreKey(1); // We use keyId 1
  if (!signedPreKey) {
    throw new Error('No signed prekey found. Please log in again.');
  }

  // Import keys
  const ourIdentityPrivate = await importPrivateKey(ourIdentity.privateKey);
  const ourSignedPreKeyPrivate = await importPrivateKey(signedPreKey.privateKey);
  const senderIdentityPublic = await importPublicKey(senderIdentityKey);
  const senderEphemeralPublic = await importPublicKey(senderEphemeralKey);

  // DH1: Our signed prekey private + Their identity public (reverse of initiator's DH1)
  const dh1 = await performDH(ourSignedPreKeyPrivate, senderIdentityPublic);

  // DH2: Our identity private + Their ephemeral public (reverse of initiator's DH2)
  const dh2 = await performDH(ourIdentityPrivate, senderEphemeralPublic);

  // DH3: Our signed prekey private + Their ephemeral public (reverse of initiator's DH3)
  const dh3 = await performDH(ourSignedPreKeyPrivate, senderEphemeralPublic);

  const dhResults = [dh1, dh2, dh3];

  // DH4 (optional): One-time prekey
  if (usedOneTimePreKeyId !== null) {
    const oneTimePreKey = await keyStorage.getOneTimePreKey(usedOneTimePreKeyId);
    if (oneTimePreKey) {
      const ourOneTimePreKeyPrivate = await importPrivateKey(oneTimePreKey.privateKey);
      const dh4 = await performDH(ourOneTimePreKeyPrivate, senderEphemeralPublic);
      dhResults.push(dh4);

      // Delete the used one-time prekey
      await keyStorage.deleteOneTimePreKey(usedOneTimePreKeyId);
    }
  }

  const sharedSecret = await kdf(dhResults);

  return arrayBufferToBase64(sharedSecret);
}

/**
 * Verify a signed prekey signature
 */
export async function verifySignedPreKey(
  identityKey: string,
  signedPreKey: string,
  signature: string
): Promise<boolean> {
  try {
    const identityKeyBuffer = base64ToArrayBuffer(identityKey);

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
    return false;
  }
}

export type { PreKeyBundle, X3DHResult };