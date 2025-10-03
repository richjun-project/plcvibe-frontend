import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils/cn"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-blue-600/20 text-blue-400 border-blue-500/30",
        secondary:
          "border-transparent bg-gray-800 text-gray-300 border-gray-700",
        destructive:
          "border-transparent bg-red-600/20 text-red-400 border-red-500/30",
        success:
          "border-transparent bg-green-600/20 text-green-400 border-green-500/30",
        warning:
          "border-transparent bg-yellow-600/20 text-yellow-400 border-yellow-500/30",
        outline: "text-gray-300 border-gray-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }