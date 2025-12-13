// Automatically replenish one-time prekeys when running low

import { getPreKeyCount, uploadOneTimePreKeys } from './KeyAPI';
import { generateOneTimePreKeys } from './KeyGenerator';
import { keyStorage } from './KeyStorage';

const MIN_PREKEYS = 5;
const REPLENISH_COUNT = 10;

/**
 * Check and replenish one-time prekeys if running low
 */
export async function checkAndReplenishPreKeys(): Promise<void> {
  try {
    const status = await getPreKeyCount();
    
    if (status.count < MIN_PREKEYS) {
      console.log(`Low on prekeys (${status.count}), generating more...`);
      
      // Find the next available keyId
      const nextKeyId = Date.now(); // Use timestamp to ensure uniqueness
      
      // Generate new prekeys
      const newPreKeys = await generateOneTimePreKeys(nextKeyId, REPLENISH_COUNT);
      
      // Upload to server
      await uploadOneTimePreKeys(newPreKeys);
      
      console.log(`Replenished ${REPLENISH_COUNT} one-time prekeys`);
    }
  } catch (error) {
    console.error('Failed to check/replenish prekeys:', error);
  }
}

/**
 * Start periodic prekey replenishment check
 */
export function startPreKeyReplenishment(intervalMs: number = 60000): () => void {
  // Check immediately
  checkAndReplenishPreKeys();
  
  // Then check periodically
  const intervalId = setInterval(checkAndReplenishPreKeys, intervalMs);
  
  // Return cleanup function
  return () => clearInterval(intervalId);
}