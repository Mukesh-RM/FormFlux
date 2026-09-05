import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 focus-visible:ring-offset-2 ring-offset-panel [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.985]",
  {
    variants: {
      variant: {
        // Accent is reserved for the single primary action on a screen.
        primary:
          "bg-accent-600 text-white shadow-sm hover:bg-accent-700 dark:bg-accent-500 dark:hover:bg-accent-600",
        secondary:
          "panel text-soft hover:bg-stone-50 dark:hover:bg-stone-800/60 shadow-sm",
        ghost: "text-muted hover:text-[rgb(var(--text))] hover:bg-stone-100 dark:hover:bg-stone-800/60",
        danger:
          "bg-red-600 text-white shadow-sm hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700",
        link: "text-accent-600 dark:text-accent-400 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[0.8rem]",
        md: "h-10 px-4",
        lg: "h-11 px-5 text-[0.95rem]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
