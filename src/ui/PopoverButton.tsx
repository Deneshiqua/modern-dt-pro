import { Fragment, type ReactNode } from "react";
import {
  Popover,
  PopoverButton as HeadlessPopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import clsx from "clsx";

import { Button, type ButtonProps } from "./Button";

type PopoverContentProps = {
  title?: ReactNode;
  description?: ReactNode;
  smallDescription?: ReactNode;
  buttons: ReactNode | ((args: { close: () => void }) => ReactNode);
  panelClassName?: string;
};

export type PopoverButtonProps = Omit<ButtonProps, "title"> &
  PopoverContentProps;

export function PopoverButton({
  title,
  description,
  smallDescription,
  buttons,
  panelClassName,
  children,
  ...buttonProps
}: PopoverButtonProps) {
  return (
    <Popover className="relative inline-block">
      <HeadlessPopoverButton as={Button} {...buttonProps}>
        {children}
      </HeadlessPopoverButton>

      <Transition
        as={Fragment}
        enter="transition ease-out"
        enterFrom="opacity-0 translate-y-2"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-2"
      >
        <PopoverPanel
          anchor={{ to: "top", gap: 8 }}
          className={clsx(
            "z-[100] w-80 rounded-md border border-gray-300 bg-white p-4 shadow-lg outline-hidden dark:border-dark-500 dark:bg-dark-750",
            panelClassName,
          )}
        >
          {({ close }) => (
            <div className="flex flex-col gap-3">
              {title && (
                <h3 className="text-base font-medium tracking-wide text-gray-800 dark:text-dark-100">
                  {title}
                </h3>
              )}
              {description && <p>{description}</p>}
              <div className="flex gap-2">
                {typeof buttons === "function" ? buttons({ close }) : buttons}
              </div>
              {smallDescription && (
                <p className="text-xs text-gray-400 dark:text-dark-300">
                  {smallDescription}
                </p>
              )}
            </div>
          )}
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
