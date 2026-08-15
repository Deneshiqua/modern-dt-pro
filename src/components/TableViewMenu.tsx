import { Button } from "../ui";
import { Switch } from "../ui/Switch";
import { Fragment, type MouseEvent } from "react";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";

export type TableViewSettings = {
  fullScreen: boolean;
  rowDense: boolean;
  columnBorders: boolean;
  stickyHeader: boolean;
  rowSelection: boolean;
  sorting: boolean;
  columnFilter: boolean;
  columnHeaderFilter: boolean;
  columnPicker: boolean;
  grouping: boolean;
  expandGroups: boolean;
  excelExport: boolean;
  jsonExport: boolean;
  search: boolean;
  showTitle: boolean;
  virtualization: boolean;
  columnResizing: boolean;
  fitColumns: boolean;
};

type TableViewMenuProps = {
  settings: TableViewSettings;
  onChange: (patch: Partial<TableViewSettings>) => void;
};

const APPEARANCE_SWITCHES: { key: keyof TableViewSettings; label: string }[] = [
  { key: "fullScreen", label: "Tam Ekran" },
  { key: "rowDense", label: "Satırları Sıkıştır" },
  { key: "columnBorders", label: "Kolon Çizgileri" },
  { key: "stickyHeader", label: "Başlığı Sabitle" },
  { key: "virtualization", label: "Sanal kaydırma" },
  { key: "fitColumns", label: "Kolonları Sığdır" },
];

const FEATURE_SWITCHES: { key: keyof TableViewSettings; label: string }[] = [
  { key: "showTitle", label: "Tablo başlığı" },
  { key: "rowSelection", label: "Satır seçimi" },
  { key: "sorting", label: "Kolon sıralama" },
  { key: "columnFilter", label: "Kolon filtresi" },
  { key: "columnHeaderFilter", label: "Kolon başlık filtresi" },
  { key: "columnPicker", label: "Kolon seçici" },
  { key: "columnResizing", label: "Kolon genişliği" },
  { key: "grouping", label: "Gruplama" },
  { key: "excelExport", label: "Excel indir" },
  { key: "jsonExport", label: "JSON indir" },
  { key: "search", label: "Arama" },
];

export function TableViewMenu({ settings, onChange }: TableViewMenuProps) {
  return (
    <Popover className="relative inline-flex">
      <PopoverButton
        as={Button}
        isIcon
        variant="flat"
        className="size-8 rounded-full"
        title="Tablo görünümü"
      >
        <AdjustmentsHorizontalIcon className="size-4.5" />
      </PopoverButton>
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
          anchor={{ to: "bottom end", gap: 8 }}
          className="ring-primary-500/50 dark:border-dark-500 dark:bg-dark-750 z-100 w-72 rounded-md border border-gray-300 bg-white shadow-lg shadow-gray-200/50 outline-hidden focus-visible:ring-3 focus-visible:outline-hidden dark:shadow-none"
          onClick={(event: MouseEvent) => event.stopPropagation()}
        >
          <h3 className="dark:text-dark-100 px-3 pt-2.5 text-sm font-medium tracking-wide text-gray-800">
            Tablo Görünümü
          </h3>
          <div className="dark:text-dark-100 mt-3 mb-3 flex max-h-[min(28rem,70vh)] flex-col items-start space-y-2 overflow-y-auto px-3 text-gray-600">
            {APPEARANCE_SWITCHES.map((item) => (
              <Switch
                key={item.key}
                label={item.label}
                checked={Boolean(settings[item.key])}
                onChange={(event) =>
                  onChange({ [item.key]: event.currentTarget.checked })
                }
              />
            ))}

            <div className="flex w-full items-center gap-2 pt-1">
              <p className="text-xs shrink-0">Özellikler</p>
              <hr className="dark:border-dark-500 flex-1 border-gray-300" />
            </div>

            {FEATURE_SWITCHES.map((item) => (
              <Fragment key={item.key}>
                <Switch
                  label={item.label}
                  checked={Boolean(settings[item.key])}
                  onChange={(event) =>
                    onChange({ [item.key]: event.currentTarget.checked })
                  }
                />
                {item.key === "grouping" ? (
                  <Switch
                    label="Grupları Genişlet"
                    checked={settings.expandGroups}
                    disabled={!settings.grouping}
                    onChange={(event) =>
                      onChange({ expandGroups: event.currentTarget.checked })
                    }
                  />
                ) : null}
              </Fragment>
            ))}
          </div>
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
