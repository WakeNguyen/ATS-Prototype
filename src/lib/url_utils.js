/**
 * Normalize Facebook group URL for consistent deduplication:
 * - Trim whitespace
 * - Strip trailing slashes
 * - Lowercase protocol and hostname
 * @param {string} rawUrl
 * @returns {string}
 */
export function normalizeSocialGroupUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const hasProtocol = /^https?:\/\//i.test(trimmed);
    const parsed = new URL(hasProtocol ? trimmed : `https://${trimmed}`);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return `${protocol}//${hostname}${pathname}${parsed.search}`;
  } catch {
    return trimmed.replace(/\/+$/, '').toLowerCase();
  }
}
