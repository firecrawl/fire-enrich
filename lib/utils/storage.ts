/**
 * Safe localStorage utilities that work in both browser and server environments
 */

/**
 * Safely gets an item from localStorage
 * Returns null if localStorage is not available or if the key doesn't exist
 */
export function getLocalStorageItem(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    if (typeof window?.localStorage?.getItem !== 'function') return null;

    return window.localStorage.getItem(key);
  } catch (error) {
    // Silently fail - localStorage might be blocked or unavailable
    return null;
  }
}

/**
 * Safely sets an item in localStorage
 * Returns true if successful, false otherwise
 */
export function setLocalStorageItem(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (typeof window?.localStorage?.setItem !== 'function') return false;

    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    // Silently fail - localStorage might be blocked or unavailable
    return false;
  }
}

/**
 * Safely removes an item from localStorage
 * Returns true if successful, false otherwise
 */
export function removeLocalStorageItem(key: string): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.localStorage) return false;
  if (typeof window.localStorage.removeItem !== 'function') return false;

  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Error removing from localStorage:', error);
    return false;
  }
}
