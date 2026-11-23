import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex max-w-full items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold leading-tight [overflow-wrap:normal] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/15 bg-primary/10 text-primary shadow-none hover:bg-primary/15",
        secondary:
          "border-border/70 bg-muted text-muted-foreground hover:bg-muted/80",
        destructive:
          "border-destructive/20 bg-destructive/10 text-destructive shadow-none hover:bg-destructive/15",
        outline: "border-border bg-card text-foreground shadow-none",
        success: "border-success/20 bg-success/10 text-success-foreground shadow-none",
        warning: "border-warning/25 bg-warning/10 text-warning-foreground shadow-none",
        info: "border-info/20 bg-info/10 text-info-foreground shadow-none",
        neutral: "border-border bg-muted text-muted-foreground shadow-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
