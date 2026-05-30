import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';
import { initialMenuData } from './initialMenuData';

/**
 * Computes a secure SHA-256 hex string using native Web Crypto subtle API.
 * This does not require any external dependency and works flawlessly in all browsers.
 */
export async function hashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Format currency to TWD NT$ string
 */
export function formatCurrency(price: number): string {
  return `$${price}`;
}

/**
 * Verification of the standard Taiwan Phone Format (09xx-xxx-xxx or similar)
 */
export function isValidPhone(phone: string): boolean {
  return /^09\d{8}$/.test(phone.replace(/[-\s]/g, ''));
}
