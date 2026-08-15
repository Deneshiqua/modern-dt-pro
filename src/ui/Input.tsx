import {
  type InputHTMLAttributes,
  type ReactNode,
  forwardRef,
} from "react";
import clsx from "clsx";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
  prefix?: ReactNode;
  unstyled?: boolean;
  classNames?: {
    root?: string;
    wrapper?: string;
    input?: string;
    prefix?: string;
  };
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    prefix,
    unstyled,
    className,
    classNames = {},
    ...rest
  },
  ref,
) {
  return (
    <div className={clsx("flex flex-col", classNames.root)}>
      <div className={clsx("relative", classNames.wrapper)}>
        <input
          ref={ref}
          className={clsx(
            "block w-full appearance-none bg-transparent tracking-wide outline-hidden transition-colors",
            prefix && "ltr:pl-9 rtl:pr-9",
            !unstyled &&
              "rounded-lg border border-gray-300 px-3 py-2 text-start text-gray-800 placeholder:font-light placeholder:text-gray-600 hover:border-gray-400 focus:border-primary-600 dark:border-dark-450 dark:text-dark-100 dark:placeholder:text-dark-200 dark:hover:border-dark-400 dark:focus:border-primary-500",
            className,
            classNames.input,
          )}
          {...rest}
        />
        {prefix ? (
          <div
            className={clsx(
              "absolute top-0 flex h-full w-9 items-center justify-center text-gray-400 ltr:left-0 rtl:right-0 dark:text-dark-300",
              classNames.prefix,
            )}
          >
            {prefix}
          </div>
        ) : null}
      </div>
    </div>
  );
});
