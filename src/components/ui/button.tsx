import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-w-0 max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg text-center text-sm font-semibold cursor-pointer transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [overflow-wrap:normal] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "min-h-11 rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:translate-y-px",
        destructive: "min-h-11 rounded-lg bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "min-h-11 rounded-lg border border-border bg-card text-foreground shadow-none hover:border-primary/35 hover:bg-muted",
        secondary: "min-h-11 rounded-lg border border-border bg-card text-foreground shadow-none hover:bg-muted",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-2.5 pointer-coarse:min-h-11",
        sm: "min-h-8 pointer-coarse:min-h-11 rounded-md px-3 py-1.5 text-xs",
        lg: "min-h-10 rounded-md px-8 py-2",
        icon: "size-9 shrink-0 pointer-coarse:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
