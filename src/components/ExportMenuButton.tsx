import { Menu, MenuButton, MenuItem, MenuItems, Transition } from "@headlessui/react";
import clsx from "clsx";
import { Fragment, type ReactNode } from "react";

import { Button } from "../ui";
import { EXPORT_MENU_SECTIONS } from "../utils/exportTable";
import type { ExportMode, ExportScope } from "../types";

export type ExportFormat = "xlsx" | "json";

const FORMAT_LABELS: Record<ExportFormat, string> = { xlsx: "Excel", json: "Json" };

export function ExportMenuButton({
  formats,
  titleText,
  icon,
  hasData,
  selectedRecordCount,
  onExport,
}: {
  formats: ExportFormat[];
  titleText: string;
  icon: ReactNode;
  hasData: boolean;
  selectedRecordCount: number;
  onExport: (format: ExportFormat, scope: ExportScope, mode: ExportMode) => void;
}) {

  return (
    <Menu as="div" className="relative inline-flex">
      <MenuButton
        as={Button}
        variant="flat"
        isIcon
        className="size-8 rounded-full"
        title={titleText}
        disabled={!hasData}
      >
        {icon}
      </MenuButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-75"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <MenuItems className="absolute right-0 z-[12000] mt-1.5 w-72 origin-top-right rounded-lg border border-gray-200 bg-white py-1 shadow-lg outline-hidden focus:outline-hidden dark:border-dark-500 dark:bg-dark-750">
          {EXPORT_MENU_SECTIONS.map((section, sectionIndex) => {
            const sectionDisabled =
              section.scope === "selected" && selectedRecordCount === 0;

            return (
              <div key={section.scope}>
                {sectionIndex > 0 ? (
                  <div className="my-1 border-t border-gray-200 dark:border-dark-500" />
                ) : null}
                <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-gray-400 dark:text-dark-300">
                  {section.title}
                </div>
                {formats.flatMap((format) => section.items.map((item) => (
                  <MenuItem key={`${section.scope}-${format}-${item.mode}`} disabled={sectionDisabled}>
                    {({ focus, disabled }) => (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onExport(format, section.scope, item.mode)}
                        className={clsx(
                          "flex w-full px-3 py-2 text-left text-sm outline-hidden transition-colors",
                          disabled
                            ? "cursor-not-allowed text-gray-300 dark:text-dark-500"
                            : focus
                              ? "bg-gray-100 text-gray-900 dark:bg-dark-600 dark:text-dark-50"
                              : "text-gray-700 dark:text-dark-100",
                        )}
                      >
                        {item.mode === "table"
                          ? `Tablo Görünümüyle ${FORMAT_LABELS[format]} İndir`
                          : `Ham Data ${FORMAT_LABELS[format]} İndir`}
                      </button>
                    )}
                  </MenuItem>
                )))}
              </div>
            );
          })}
        </MenuItems>
      </Transition>
    </Menu>
  );
}
