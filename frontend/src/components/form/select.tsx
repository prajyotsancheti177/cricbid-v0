/**
 * The app's Select.
 *
 * Identical to the generated shadcn component except for one behaviour: a
 * rapid second click on the trigger no longer toggles the just-opened menu
 * shut. Clicking a dropdown twice quickly — easy to do by accident, and common
 * on touch — made the list appear and vanish, which reads as the form closing
 * itself rather than as a toggle.
 *
 * Lives here rather than in components/ui so the generated files stay
 * regenerable (see CLAUDE.md). Import Select from this module, not from
 * components/ui/select.
 */
import * as React from "react";
import {
  Select as BaseSelect,
  SelectTrigger as BaseSelectTrigger,
} from "@/components/ui/select";

export {
  SelectGroup,
  SelectValue,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "@/components/ui/select";

/** Re-clicks landing inside this window are treated as an accidental repeat. */
const REPEAT_CLICK_MS = 350;

/**
 * When a select last opened or closed, anywhere in the app.
 *
 * A select renders in a portal outside the dialog that contains it, so the
 * click that dismisses the dropdown can reach the dialog's own dismiss layer
 * and be read as a click outside it — closing the whole dialog. Dialogs use
 * `selectRecentlyInteracted()` to ignore an outside click that arrives on the
 * heels of a dropdown closing.
 */
let lastSelectActivity = 0;

export const selectRecentlyInteracted = (withinMs = 500) =>
  Date.now() - lastSelectActivity < withinMs;

/** Records open/close so a dialog can tell a stray click from a real one. */
const Select = ({
  onOpenChange,
  ...props
}: React.ComponentProps<typeof BaseSelect>) => (
  <BaseSelect
    onOpenChange={(open) => {
      lastSelectActivity = Date.now();
      onOpenChange?.(open);
    }}
    {...props}
  />
);
Select.displayName = "Select";

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof BaseSelectTrigger>,
  React.ComponentPropsWithoutRef<typeof BaseSelectTrigger>
>(({ onPointerDown, ...props }, ref) => {
  const lastPointerDown = React.useRef(0);

  return (
    <BaseSelectTrigger
      ref={ref}
      onPointerDown={(event) => {
        const now = Date.now();
        if (now - lastPointerDown.current < REPEAT_CLICK_MS) {
          // Radix composes handlers and skips its own once the default is
          // prevented, so this swallows the toggle-close. Deliberately closing
          // by clicking the trigger again still works after the window, as do
          // Escape, clicking away, and picking an item.
          event.preventDefault();
          return;
        }
        lastPointerDown.current = now;
        onPointerDown?.(event);
      }}
      {...props}
    />
  );
});
SelectTrigger.displayName = "SelectTrigger";

export { Select, SelectTrigger };
