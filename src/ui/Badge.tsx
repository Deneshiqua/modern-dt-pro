import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type Variant = "filled" | "outlined" | "soft";
type Color = "neutral" | "primary" | "secondary";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children?: ReactNode;
  variant?: Variant;
  color?: Color;
};

const variants: Record<Color, Record<Variant, string>> = {
  neutral: {
    filled: "bg-gray-200 text-gray-900 dark:bg-dark-500 dark:text-dark-50",
    outlined: "border border-gray-300 text-gray-900 dark:border-dark-500",
    soft: "bg-gray-200/30 text-gray-900 dark:bg-dark-500/30 dark:text-dark-50",
  },
  primary: {
    filled: "bg-primary-600 text-white",
    outlined: "border border-primary-300 text-primary-700",
    soft: "bg-primary-600/10 text-primary-700 dark:text-primary-300",
  },
  secondary: {
    filled: "bg-gray-500 text-white",
    outlined: "border border-gray-400 text-gray-700",
    soft: "bg-gray-500/10 text-gray-700 dark:text-dark-100",
  },
};

export function Badge({
  className,
  children,
  variant = "filled",
  color = "neutral",
  ...rest
}: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-sm px-2 py-1 text-xs font-medium leading-none tracking-wide",
        variants[color][variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
