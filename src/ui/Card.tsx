import { type HTMLAttributes, type ReactNode, forwardRef } from "react";
import clsx from "clsx";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  skin?: "none" | "bordered" | "shadow";
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, children, skin = "shadow", ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={clsx(
        "rounded-lg",
        skin === "bordered" &&
          "border border-gray-200 dark:border-dark-600 print:border-0",
        skin === "shadow" &&
          "bg-white shadow-sm dark:bg-dark-700 dark:shadow-none print:shadow-none",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
