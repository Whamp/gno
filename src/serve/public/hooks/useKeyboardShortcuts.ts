/**
 * useKeyboardShortcuts - Global keyboard shortcut handler hook.
 *
 * Features:
 * - Supports meta (Cmd/Ctrl) + shift modifiers
 * - Skips shortcuts when user is typing in inputs
 * - Platform-appropriate modifier display
 */

import { useEffect, useMemo } from "react";

export interface Shortcut {
  /** Key to match (case-insensitive) */
  key: string;
  /** Require Cmd (Mac) or Ctrl (Windows/Linux) */
  meta?: boolean;
  /** Require Shift key */
  shift?: boolean;
  /** Action to execute */
  action: () => void;
  /** Skip when user is in text input */
  skipInInput?: boolean;
}

/**
 * Web apps use Ctrl on all platforms to avoid browser shortcut conflicts.
 * Cmd+N/K/T etc are reserved by browsers on Mac (new window, location bar, new tab).
 */
export const modKey = "Ctrl";

/**
 * Check if event target is an input element
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea") return true;
  if (target.isContentEditable) return true;

  // Check for CodeMirror
  if (target.closest(".cm-editor")) return true;

  return false;
}

/**
 * Register keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]): void {
  // Memoize to prevent unnecessary re-registrations
  const memoizedShortcuts = useMemo(() => shortcuts, [shortcuts]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const shortcut of memoizedShortcuts) {
        // Check modifiers (always Ctrl, never Cmd - avoids browser conflicts)
        const metaMatch = shortcut.meta ? e.ctrlKey : !e.ctrlKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;

        // Check key
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (keyMatch && metaMatch && shiftMatch) {
          // Skip if typing in input (default: skip for all shortcuts)
          const skipInput = shortcut.skipInInput ?? true;
          if (skipInput && isInputElement(e.target)) {
            continue;
          }

          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [memoizedShortcuts]);
}
