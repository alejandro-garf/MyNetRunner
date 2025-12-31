// Automatically replenish one-time prekeys when running low

import { getPreKeyCount, uploadOneTimePreKeys } from './KeyAPI';
import { generateOneTimePreKeys } from './KeyGenerator';


const MIN_PREKEYS = 5;
const REPLENISH_COUNT = 10;

/**
 * Check and replenish one-time prekeys if running low
 */
export async function checkAndReplenishPreKeys(): Promise<void> {
  try {
    const status = await getPreKeyCount();

    if (status.count < MIN_PREKEYS) {
      // Find the next available keyId
      const nextKeyId = Date.now(); // Use timestamp to ensure uniqueness

      // Generate new prekeys
      const newPreKeys = await generateOneTimePreKeys(nextKeyId, REPLENISH_COUNT);

      // Upload to server
      await uploadOneTimePreKeys(newPreKeys);
    }
  } catch (error) {
    // Failed to check/replenish prekeys
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