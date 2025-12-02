/**
 * Simple Logger Utility
 *
 * Provides environment-aware logging. Debug logs are suppressed in production.
 * Usage:
 *   import { logger } from '@/libs/logger';
 *   logger.debug('Photo processed', { size: 1024 });
 *   logger.info('Generation complete');
 *   logger.warn('Rate limit approaching');
 *   logger.error('Failed to generate', error);
 */

const isDevelopment = process.env.NODE_ENV !== "production";

export const logger = {
  /**
   * Debug logs - only shown in development
   */
  debug: (message: string, ...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Info logs - shown in all environments
   */
  info: (message: string, ...args: unknown[]): void => {
    console.log(`[INFO] ${message}`, ...args);
  },

  /**
   * Warning logs - shown in all environments
   */
  warn: (message: string, ...args: unknown[]): void => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  /**
   * Error logs - always shown
   */
  error: (message: string, ...args: unknown[]): void => {
    console.error(`[ERROR] ${message}`, ...args);
  },
};

export default logger;
