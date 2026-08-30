import * as React from "react"
import { cn } from "../../lib/utils"
import { Loader2 } from "lucide-react"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "glass"
  size?: "default" | "sm" | "lg" | "icon"
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={isLoading || props.disabled}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
          {
            "bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 hover:-translate-y-0.5 border border-primary-500/20": variant === "default",
            "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30": variant === "destructive",
            "border border-slate-200/50 bg-white/50 backdrop-blur-md hover:bg-white/80 hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/50 dark:hover:bg-slate-800/80 dark:hover:text-white shadow-sm": variant === "outline",
            "bg-slate-100/80 text-slate-900 backdrop-blur-md hover:bg-slate-200/80 dark:bg-slate-800/80 dark:text-white dark:hover:bg-slate-700/80": variant === "secondary",
            "hover:bg-slate-100/50 hover:text-slate-900 dark:hover:bg-slate-800/50 dark:hover:text-white": variant === "ghost",
            "text-slate-900 underline-offset-4 hover:underline dark:text-slate-50": variant === "link",
            "border border-white/40 bg-white/40 backdrop-blur-xl hover:bg-white/60 dark:border-white/10 dark:bg-slate-900/40 dark:hover:bg-slate-800/60 shadow-[0_4px_12px_rgb(0,0,0,0.05)]": variant === "glass",
            "h-10 px-4 py-2": size === "default",
            "h-9 rounded-lg px-3": size === "sm",
            "h-11 rounded-xl px-8 text-base": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
export default Button;
