import {
  type InputHTMLAttributes,
  type ReactNode,
  forwardRef,
  useEffect,
  useRef,
} from "react";
import clsx from "clsx";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: ReactNode;
  indeterminate?: boolean;
  classNames?: {
    input?: string;
    label?: string;
    labelText?: string;
  };
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      label,
      indeterminate,
      className,
      classNames = {},
      disabled,
      ...rest
    },
    ref,
  ) {
    const innerRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      const node = innerRef.current;
      if (node) {
        node.indeterminate = Boolean(indeterminate);
      }
    }, [indeterminate]);

    const setRefs = (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    const input = (
      <input
        ref={setRefs}
        type="checkbox"
        disabled={disabled}
        className={clsx(
          "dtp-checkbox size-4 shrink-0 cursor-pointer",
          className,
          classNames.input,
        )}
        {...rest}
      />
    );

    if (!label) {
      return input;
    }

    return (
      <label
        className={clsx(
          "inline-flex items-center gap-2",
          classNames.label,
        )}
      >
        {input}
        <span className={clsx("label", classNames.labelText)}>{label}</span>
      </label>
    );
  },
);
