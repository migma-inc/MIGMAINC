import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface SwitchProps {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    disabled?: boolean
    className?: string
    labelLeft?: string
    labelRight?: string
}

export const Switch = React.forwardRef<HTMLDivElement, SwitchProps>(
    ({ checked, onCheckedChange, disabled, className, labelLeft, labelRight }, ref) => {
        return (
            <div className={cn("flex items-center gap-3", className)} ref={ref}>
                {labelLeft && (
                    <span className={cn(
                        "text-xs font-bold transition-colors uppercase tracking-wider",
                        !checked ? "text-gold-light" : "text-gray-500"
                    )}>
                        {labelLeft}
                    </span>
                )}
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onCheckedChange(!checked)}
                    className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-medium focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50",
                        checked ? "bg-gold-medium" : "bg-zinc-700"
                    )}
                >
                    <motion.span
                        animate={{ x: checked ? 20 : 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={cn(
                            "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform"
                        )}
                    />
                </button>
                {labelRight && (
                    <span className={cn(
                        "text-xs font-bold transition-colors uppercase tracking-wider",
                        checked ? "text-gold-light" : "text-gray-500"
                    )}>
                        {labelRight}
                    </span>
                )}
            </div>
        )
    }
)

Switch.displayName = "Switch"
