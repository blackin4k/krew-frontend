import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { color?: string }
>(({ className, color, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      "data-[orientation=vertical]:flex-col data-[orientation=vertical]:w-4 data-[orientation=vertical]:h-full data-[orientation=vertical]:justify-center",
      className
    )}
    {...props}
  >
    {/* TRACK */}
    <SliderPrimitive.Track
      className="
        relative
        h-2
        w-full
        grow
        rounded-full
        bg-white/20
        data-[orientation=vertical]:w-2
        data-[orientation=vertical]:h-full
      "
    >
      {/* PROGRESS */}
      <SliderPrimitive.Range
        className="absolute rounded-full data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
        style={{ backgroundColor: color || '#3b82f6' }} // Default to tailwind blue-500 if no color
      />
    </SliderPrimitive.Track>

    {/* THUMB */}
    <SliderPrimitive.Thumb
      className="
        block
        h-4
        w-4
        rounded-full
        border-0
        ring-offset-background
        transition-colors
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-offset-2
        disabled:pointer-events-none
        disabled:opacity-50
        cursor-pointer
      "
      style={{ backgroundColor: color || '#3b82f6' }}
    />
  </SliderPrimitive.Root>
))

Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
