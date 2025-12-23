/**
 * Centralized authentication storage utility
 * Handles all localStorage operations for authentication
 */

import { User } from '../types';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

/**
 * Get authentication token from storage
 */
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Get user data from storage
 */
export const getUser = (): User | null => {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;

  try {
    return JSON.parse(userStr) as User;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to parse user from storage:', error);
    return null;
  }
};

/**
 * Save authentication data to storage
 */
export const saveAuth = (token: string, user: User): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

/**
 * Clear authentication data from storage
 */
export const clearAuth = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return getToken() !== null;
};
