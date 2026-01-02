/**
 * ShortcutHelpModal - Displays available keyboard shortcuts.
 *
 * Features:
 * - Grouped by context (Global, Editor, Navigation)
 * - Platform-appropriate modifier display
 * - Triggered by Cmd+/ or help button
 */

import { KeyboardIcon } from "lucide-react";

import { modKey } from "../hooks/useKeyboardShortcuts";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export interface ShortcutHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
  keys: string;
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: `${modKey}+N`, description: "New note" },
      { keys: `${modKey}+K`, description: "Focus search" },
      { keys: `${modKey}+/`, description: "Show shortcuts" },
      { keys: "Esc", description: "Close modal" },
    ],
  },
  {
    title: "Editor",
    shortcuts: [
      { keys: `${modKey}+S`, description: "Save" },
      { keys: `${modKey}+B`, description: "Bold" },
      { keys: `${modKey}+I`, description: "Italic" },
      { keys: `${modKey}+K`, description: "Insert link" },
      { keys: "Esc", description: "Close editor" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [{ keys: `${modKey}+Enter`, description: "Submit form" }],
  },
];

export function ShortcutHelpModal({
  open,
  onOpenChange,
}: ShortcutHelpModalProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyboardIcon className="size-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 font-medium text-muted-foreground text-sm">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    className="flex items-center justify-between"
                    key={shortcut.keys}
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <Badge className="font-mono" variant="outline">
                      {shortcut.keys}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
