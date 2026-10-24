import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-slate-900 text-slate-50",
        outline: "border-slate-200 text-slate-700",
        essential: "border-rose-200 bg-rose-50 text-rose-700",
        important: "border-amber-200 bg-amber-50 text-amber-800",
        supply: "border-violet-200 bg-violet-50 text-violet-700",
        review: "border-sky-200 bg-sky-50 text-sky-700",
        muted: "border-slate-200 bg-slate-50 text-slate-500",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
