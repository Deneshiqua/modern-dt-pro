import { useMemo, useState } from "react";

import { DataTable, type NotifyType } from "modern-dt-pro";
import {
  COLUMN_LABELS,
  SAMPLE_SQL,
  VALUE_MAPPERS,
  createDemoRows,
  type DemoRow,
} from "./data";

type PlaygroundProps = {
  onNotify: (type: NotifyType, message: string) => void;
};

// "Satir stili" acikken: taslak kayitlar soluk, toplami 2000 ve ustu olanlar vurgulu
const playgroundRowClassName = (row: DemoRow) => (row.status === 0 ? "pg-row-muted" : undefined);
const playgroundRowStyle = (row: DemoRow) =>
  row.total >= 2000 ? { backgroundColor: "rgba(245, 158, 11, 0.16)" } : undefined;

function buildPlaygroundCode(options: {
  title: string;
  sql: boolean;
  doubleClick: boolean;
  rowStyling: boolean;
  settingsPanel: boolean;
}) {
  const lines = [
    'import { DataTable } from "modern-dt-pro";',
    "",
    "<DataTable",
    "  data={rows}",
    `  title="${options.title}"`,
    '  excludeColumns={["id"]}',
    "  columnLabels={COLUMN_LABELS}",
    "  valueMappers={VALUE_MAPPERS}",
    "  enableSorting={false}",
    "  enableColumnFilter={false}",
    "  enableColumnHeaderFilter={false}",
    "  enableColumnPicker={false}",
    "  enableGrouping={false}",
    "  enableExcelExport={false}",
    "  enableJsonExport={false}",
    "  enableSearch={false}",
    "  enableVirtualization={false}",
    "  enableColumnResizing={false}",
    "  fitColumns={false}",
    "  defaultViewSettings={{ showTitle: false, expandGroups: false }}",
  ];

  if (options.sql) lines.push("  sqlQuery={SAMPLE_SQL}");
  if (options.settingsPanel) lines.push("  enableSettingsPanel", "  enableDataImport");
  if (options.doubleClick) {
    lines.push("  onRowDoubleClick={(row) => onNotify(\"success\", `${row.code} · ${row.name}`)}");
  }
  if (options.rowStyling) {
    lines.push(
      '  rowClassName={(row) => (row.status === 0 ? "pg-row-muted" : undefined)}',
      "  rowStyle={(row) =>",
      '    row.total >= 2000 ? { backgroundColor: "rgba(245, 158, 11, 0.16)" } : undefined}',
    );
  }
  lines.push("/>");

  return lines.join("\n");
}

type ChipProps = {
  active: boolean;
  onClick: () => void;
  children: string;
};

function Chip({ active, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      className={active ? "pg-chip active" : "pg-chip"}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Playground({ onNotify }: PlaygroundProps) {
  const rows = useMemo(() => createDemoRows(200), []);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState("Playground");
  const [sql, setSql] = useState(false);
  const [doubleClick, setDoubleClick] = useState(false);
  const [rowStyling, setRowStyling] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState(true);
  const [selectedCount, setSelectedCount] = useState(0);

  const code = buildPlaygroundCode({ title, sql, doubleClick, rowStyling, settingsPanel });

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="card playground-card">
      <h2>Canlı Playground</h2>
      <p className="desc" style={{ marginBottom: "1.25rem" }}>
        Parametreleri değiştirerek tablonun nasıl oluştuğunu anında gör.
      </p>

      <div className="playground-preview-wrap">
        <div className="playground-preview-header">
          <span>Önizleme</span>
          <button
            type="button"
            className={showCode ? "pg-code-btn active" : "pg-code-btn"}
            onClick={() => setShowCode((value) => !value)}
          >
            Code
          </button>
        </div>

        <div className="pg-preview-toolbar">
          <Chip active={sql} onClick={() => setSql((value) => !value)}>
            SQL
          </Chip>
          <Chip active={settingsPanel} onClick={() => setSettingsPanel((value) => !value)}>
            Tablo ayarları
          </Chip>
          <Chip active={doubleClick} onClick={() => setDoubleClick((value) => !value)}>
            Çift tıklama
          </Chip>
          <Chip active={rowStyling} onClick={() => setRowStyling((value) => !value)}>
            Satır stili
          </Chip>
          <label className="pg-chip">
            <span>Başlık</span>
            <input
              className="pg-title-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
        </div>

        {showCode ? (
          <div className="playground-preview playground-preview--code">
            <div className="demo-code-toolbar">
              <button type="button" onClick={() => void copyCode()}>
                {copied ? "Kopyalandı" : "Kopyala"}
              </button>
            </div>
            <pre className="playground-code playground-code--panel">
              <code>{code}</code>
            </pre>
          </div>
        ) : (
          <div className="playground-preview">
            <DataTable
              data={rows}
              title={title}
              stateStorageKey="playground"
              excludeColumns={["id"]}
              columnLabels={COLUMN_LABELS}
              valueMappers={VALUE_MAPPERS}
              sqlQuery={sql ? SAMPLE_SQL : undefined}
              onRowDoubleClick={doubleClick ? (row) => onNotify("success", `${row.code} · ${row.name}`) : undefined}
              rowClassName={rowStyling ? playgroundRowClassName : undefined}
              rowStyle={rowStyling ? playgroundRowStyle : undefined}
              enableSettingsPanel={settingsPanel}
              enableDataImport={settingsPanel}
              onNotify={onNotify}
              onSelectionChange={(selected) => setSelectedCount(selected.length)}
              enableSorting={false}
              enableColumnFilter={false}
              enableColumnHeaderFilter={false}
              enableColumnPicker={false}
              enableGrouping={false}
              enableExcelExport={false}
              enableJsonExport={false}
              enableSearch={false}
              enableVirtualization={false}
              enableColumnResizing={false}
              fitColumns={false}
              defaultViewSettings={{ showTitle: false, expandGroups: false }}
            />
          </div>
        )}
      </div>

      {!showCode ? (
        <div className="output">
          Satır: {rows.length}
          {selectedCount > 0 ? ` · Seçili: ${selectedCount}` : ""}
        </div>
      ) : null}
    </section>
  );
}
