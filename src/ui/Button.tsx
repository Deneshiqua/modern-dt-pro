import {
  type ButtonHTMLAttributes,
  type ElementType,
  type ReactNode,
  forwardRef,
} from "react";
import clsx from "clsx";

type Variant = "filled" | "outlined" | "soft" | "flat";
type Size = "xs" | "sm" | "md" | "lg" | "xl";
type Color = "neutral" | "primary" | "error";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  color?: Color;
  isIcon?: boolean;
  variant?: Variant;
  size?: Size;
  unstyled?: boolean;
  component?: ElementType;
};

const variants: Record<Variant, string> = {
  filled:
    "bg-primary-600 text-white hover:bg-primary-700 disabled:bg-primary-300",
  soft:
    "text-primary-700 bg-primary-600/10 hover:bg-primary-600/20 dark:text-primary-300",
  outlined:
    "text-primary-700 border border-primary-600 hover:bg-primary-50 dark:text-primary-300 dark:border-primary-400",
  flat:
    "text-gray-700 hover:bg-gray-200/60 dark:text-dark-200 dark:hover:bg-dark-300/10",
};

const colorOverrides: Record<Color, Partial<Record<Variant, string>>> = {
  neutral: {
    filled:
      "bg-gray-150 text-gray-900 hover:bg-gray-200 dark:bg-dark-600 dark:text-dark-50",
    outlined:
      "border border-gray-300 text-gray-900 hover:bg-gray-300/20 dark:border-dark-450 dark:text-dark-50",
    flat: "text-gray-700 hover:bg-gray-300/20 dark:text-dark-200 dark:hover:bg-dark-300/10",
  },
  primary: {},
  error: {
    filled: "bg-red-600 text-white hover:bg-red-700",
    outlined: "border border-red-600 text-red-600 hover:bg-red-50",
    flat: "text-red-600 hover:bg-red-50",
  },
};

const sizeClass: Record<Size, string> = {
  xs: "px-2 py-1 text-xs rounded",
  sm: "px-3 py-1.5 text-sm rounded-md",
  md: "px-5 py-2 text-base rounded-lg",
  lg: "px-6 py-3 text-lg rounded-lg",
  xl: "px-8 py-4 text-xl rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      component,
      className,
      children,
      color = "neutral",
      isIcon = false,
      variant = "filled",
      size = "sm",
      unstyled = false,
      type = "button",
      disabled,
      ...rest
    },
    ref,
  ) {
    const Component = component || "button";
    const colorClass = colorOverrides[color][variant] ?? variants[variant];

    return (
      <Component
        ref={ref}
        type={Component === "button" ? type : undefined}
        className={clsx(
          "inline-flex cursor-pointer items-center justify-center text-center font-medium tracking-wide outline-hidden transition-all duration-200 disabled:pointer-events-none disabled:select-none disabled:opacity-70",
          !unstyled && [
            "rounded-lg",
            !isIcon && sizeClass[size],
            isIcon && "shrink-0 p-0",
            colorClass,
          ],
          className,
        )}
        disabled={Component === "button" ? disabled : undefined}
        data-disabled={disabled}
        {...rest}
      >
        {children}
      </Component>
    );
  },
);
