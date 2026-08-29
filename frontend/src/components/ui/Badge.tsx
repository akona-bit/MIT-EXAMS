import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
        {
          "border-transparent bg-primary-500 text-white hover:bg-primary-600": variant === "default",
          "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100": variant === "secondary",
          "border-transparent bg-danger-500/10 text-danger-500": variant === "destructive",
          "text-slate-950 dark:text-slate-50": variant === "outline",
          "border-transparent bg-success-500/10 text-success-600 dark:text-success-500": variant === "success",
          "border-transparent bg-warning-500/10 text-warning-600 dark:text-warning-500": variant === "warning",
          "border-transparent bg-info-500/10 text-info-600 dark:text-info-500": variant === "info",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
