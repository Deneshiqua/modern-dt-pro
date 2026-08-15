import {
  type InputHTMLAttributes,
  type ReactNode,
  forwardRef,
} from "react";
import clsx from "clsx";

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & {
  label?: ReactNode;
  classNames?: {
    label?: string;
    labelText?: string;
    input?: string;
  };
};

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  function Switch(
    { label, className, classNames = {}, disabled, ...rest },
    ref,
  ) {
    const input = (
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        disabled={disabled}
        className={clsx("dtp-switch", className, classNames.input)}
        {...rest}
      />
    );

    if (!label) {
      return input;
    }

    return (
      <label
        className={clsx(
          "inline-flex cursor-pointer items-center gap-2",
          disabled && "cursor-not-allowed opacity-60",
          classNames.label,
        )}
      >
        {input}
        <span className={clsx("text-sm", classNames.labelText)}>{label}</span>
      </label>
    );
  },
);
