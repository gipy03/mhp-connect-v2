import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Re-export primitives for convenience
// ---------------------------------------------------------------------------

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

function DialogOverlay({
  className,
  ...props
}: RadixDialog.DialogOverlayProps) {
  return (
    <RadixDialog.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

interface DialogContentProps extends RadixDialog.DialogContentProps {
  /** Optional: hides the default close (×) button */
  hideClose?: boolean;
}

export function DialogContent({
  className,
  children,
  hideClose,
  ...props
}: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <DialogOverlay />
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] sm:w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
          "rounded-2xl border bg-background shadow-xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          "max-h-[90dvh] overflow-y-auto",
          className
        )}
        {...props}
      >
        {!hideClose && (
          <RadixDialog.Close className="absolute right-4 top-4 z-10 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="h-4 w-4" />
            <span className="sr-only">Fermer</span>
          </RadixDialog.Close>
        )}
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

// ---------------------------------------------------------------------------
// Convenience sub-components
// ---------------------------------------------------------------------------

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 space-y-1", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: RadixDialog.DialogTitleProps) {
  return (
    <RadixDialog.Title
      className={cn(
        "text-base font-semibold leading-snug tracking-tight",
        className
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: RadixDialog.DialogDescriptionProps) {
  return (
    <RadixDialog.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t px-4 sm:px-6 py-3 sm:py-4",
        className
      )}
      {...props}
    />
  );
}
