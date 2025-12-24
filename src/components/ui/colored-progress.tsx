import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

interface ColoredProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  value?: number;
  color?: string;
}

const ColoredProgress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ColoredProgressProps
>(({ className, value = 0, color, ...props }, ref) => {
  const getProgressColor = (percentage: number) => {
    if (percentage >= 76) return "#22c55e"; // Green (76-100%): Ready for transfer
    if (percentage >= 51) return "#eab308"; // Yellow (51-75%): Nearly complete
    if (percentage >= 26) return "#f97316"; // Orange (26-50%): In progress
    return "#ef4444"; // Red (0-25%): Just started
  };

  const progressColor = color || getProgressColor(value);

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-white border border-border",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 transition-all duration-500 ease-in-out"
        style={{ 
          transform: `translateX(-${100 - value}%)`,
          backgroundColor: progressColor
        }}
      />
    </ProgressPrimitive.Root>
  );
});

ColoredProgress.displayName = "ColoredProgress";

export { ColoredProgress };
