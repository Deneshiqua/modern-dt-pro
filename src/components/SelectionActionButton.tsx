import clsx from "clsx";

import { Button, PopoverButton } from "../ui";
import type { SelectionAction, SelectionActionVariant } from "../types";

const VARIANT_STYLES: Record<
  SelectionActionVariant,
  { outlined?: boolean; className: string }
> = {
  primary: {
    className: "!text-white !bg-indigo-600 hover:!bg-indigo-700 disabled:!bg-white/20",
  },
  danger: {
    className: "!text-white !bg-rose-600 hover:!bg-rose-700 disabled:!bg-white/20",
  },
  neutral: {
    outlined: true,
    className: "!border-white !text-white hover:!bg-white/10",
  },
};

export function SelectionActionButton({ action }: { action: SelectionAction }) {
  const variant = action.variant ?? "primary";
  const style = VARIANT_STYLES[variant];
  const buttonClassName = clsx(
    "px-3 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1",
    style.className,
  );

  if (!action.confirm) {
    return (
      <Button
        onClick={() => void action.onClick()}
        disabled={action.disabled}
        variant={style.outlined ? "outlined" : undefined}
        className={buttonClassName}
      >
        {action.icon}
        {action.label}
      </Button>
    );
  }

  const confirmConfig = typeof action.confirm === "object" ? action.confirm : undefined;
  const confirmColor = variant === "danger" ? "error" : "primary";

  return (
    <PopoverButton
      title={confirmConfig?.title ?? action.label}
      description={confirmConfig?.description ?? `${action.label} işlemini onaylıyor musunuz?`}
      disabled={action.disabled}
      buttons={({ close }) => (
        <>
          <Button
            onClick={async () => {
              await action.onClick();
              close();
            }}
            color={confirmColor}
            className="px-3 py-1.5 text-sm"
          >
            {confirmConfig?.confirmLabel ?? "Tamam"}
          </Button>
          <Button
            onClick={() => close()}
            variant="outlined"
            color={confirmColor}
            className="px-3 py-1.5 text-sm"
          >
            {confirmConfig?.cancelLabel ?? "Vazgeç"}
          </Button>
        </>
      )}
      className={buttonClassName}
    >
      {action.icon}
      {action.label}
    </PopoverButton>
  );
}
