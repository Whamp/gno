/**
 * Cross-platform path utilities for deterministic behavior.
 * Uses POSIX path operations to ensure identical results across platforms.
 *
 * CRITICAL: All converter path operations MUST use these utilities.
 * Using node:path directly will produce different results on Windows vs POSIX.
 */

// OK: no Bun path utils, must use node:path/posix for cross-platform determinism
import {
  basename as posixBasename,
  extname as posixExtname,
  normalize as posixNormalize,
} from 'node:path/posix';

/**
 * Normalize a relative path to POSIX format.
 * Converts Windows separators, normalizes ../ and ./, strips trailing slashes.
 */
export function normalizePath(p: string): string {
  // Convert Windows separators to POSIX
  const posixPath = p.replace(/\\/g, '/');
  // Normalize (resolve .., ., double slashes)
  return posixNormalize(posixPath);
}

/**
 * Get the base filename from a path (POSIX-safe).
 */
export function basename(p: string): string {
  return posixBasename(normalizePath(p));
}

/**
 * Get the file extension from a path (POSIX-safe, lowercase).
 */
export function extname(p: string): string {
  return posixExtname(normalizePath(p)).toLowerCase();
}

/**
 * Get filename without extension (for title derivation).
 */
export function basenameWithoutExt(p: string): string {
  const name = basename(p);
  const ext = posixExtname(name);
  return ext ? name.slice(0, -ext.length) : name;
}
