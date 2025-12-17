/**
 * Utility functions for QuickList
 */

/**
 * Extract the domain from an email address
 * @param {string} email - The email address (e.g., "john@gmail.com")
 * @returns {string|null} The domain (e.g., "gmail.com") or null if invalid
 * @example
 * getDomainFromEmail("john@gmail.com") // "gmail.com"
 * getDomainFromEmail("user@company.co.uk") // "company.co.uk"
 * getDomainFromEmail("invalid-email") // null
 */
export function getDomainFromEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const parts = email.trim().split('@');

  if (parts.length !== 2 || !parts[1]) {
    return null;
  }

  return parts[1].toLowerCase();
}

/**
 * Check if an email belongs to a specific domain
 * @param {string} email - The email address
 * @param {string} domain - The domain to check against
 * @returns {boolean} True if the email belongs to the domain
 * @example
 * isEmailFromDomain("john@gmail.com", "gmail.com") // true
 * isEmailFromDomain("john@gmail.com", "yahoo.com") // false
 */
export function isEmailFromDomain(email, domain) {
  const emailDomain = getDomainFromEmail(email);
  return emailDomain === domain?.toLowerCase();
}
