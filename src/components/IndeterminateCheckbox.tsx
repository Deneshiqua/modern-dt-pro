import clsx from "clsx";
import { useEffect, useRef, type HTMLProps } from "react";

// "Tümünü seç" işlevselliği için IndeterminateCheckbox bileşeni
export function IndeterminateCheckbox({
  indeterminate,
  className = "",
  ...rest
}: { indeterminate?: boolean } & HTMLProps<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate ?? false;
    }
  }, [indeterminate]);

  return (
    <input
      type="checkbox"
      ref={ref}
      className={clsx("dtp-checkbox size-4 cursor-pointer", className)}
      {...rest}
    />
  );
}
