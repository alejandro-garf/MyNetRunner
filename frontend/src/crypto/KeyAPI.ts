// API calls for key management

import { getToken } from '../utils/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

interface PreKeyBundleResponse {
  userId: number;
  username: string;
  identityKey: string;
  signedPreKey: string;
  signedPreKeyId: number;
  signedPreKeySignature: string;
  oneTimePreKeyId: number | null;
  oneTimePreKey: string | null;
}

interface KeyStatusResponse {
  hasKeys: boolean;
  availablePreKeys: number;
}

// Upload prekey bundle to server
export async function uploadPreKeyBundle(bundle: {
  identityKey: string;
  signedPreKey: string;
  signedPreKeyId: number;
  signedPreKeySignature: string;
}): Promise<void> {
  const token = getToken();
  
  const response = await fetch(`${API_BASE}/api/keys/bundle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(bundle),
  });

  if (!response.ok) {
    throw new Error('Failed to upload prekey bundle');
  }
}

// Upload one-time prekeys to server
export async function uploadOneTimePreKeys(
  preKeys: Array<{ keyId: number; publicKey: string }>
): Promise<void> {
  const token = getToken();
  
  const response = await fetch(`${API_BASE}/api/keys/prekeys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ preKeys }),
  });

  if (!response.ok) {
    throw new Error('Failed to upload one-time prekeys');
  }
}

// Fetch another user's prekey bundle for session establishment
export async function fetchPreKeyBundle(userId: number): Promise<PreKeyBundleResponse> {
  const token = getToken();
  
  const response = await fetch(`${API_BASE}/api/keys/${userId}/bundle`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch prekey bundle');
  }

  return response.json();
}

// Check if current user has registered keys on server
export async function checkKeyStatus(): Promise<KeyStatusResponse> {
  const token = getToken();
  
  const response = await fetch(`${API_BASE}/api/keys/status`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to check key status');
  }

  return response.json();
}

// Get count of available one-time prekeys
export async function getPreKeyCount(): Promise<{ count: number; needsRefill: boolean }> {
  const token = getToken();
  
  const response = await fetch(`${API_BASE}/api/keys/prekey-count`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get prekey count');
  }

  return response.json();
}

export type { PreKeyBundleResponse, KeyStatusResponse };