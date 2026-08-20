export const BASIC_CODE = `import { DataTable } from "modern-dt-pro";
import "modern-dt-pro/styles.css";

<DataTable
  data={rows}
  title="Temel tablo"
  excludeColumns={["id"]}
  columnLabels={COLUMN_LABELS}
/>`;

export const GROUPED_CODE = `import { DataTable } from "modern-dt-pro";

<DataTable
  data={rows}
  title="Kategoriye göre gruplu"
  excludeColumns={["id"]}
  columnLabels={COLUMN_LABELS}
  defaultGrouping={["category"]}
  defaultSorting={[{ id: "createdAt", desc: false }]}
/>`;

export const SELECTION_CODE = `import { DataTable } from "modern-dt-pro";

<DataTable
  data={rows}
  title="Satır seçimi"
  excludeColumns={["id"]}
  columnLabels={COLUMN_LABELS}
  enableRowSelection
  onSelectionChange={setSelected}
  onDeleteSelected={handleDelete}
  onTransferSelected={handleTransfer}
/>`;

export const CONTROLLED_SERVER_CODE = `import { useMemo, useRef } from "react";
import {
  DataTable,
  serializeLoadOptions,
  type DataTableDataSource,
  type DataTableHandle,
} from "modern-dt-pro";

const tableRef = useRef<DataTableHandle>(null);
const dataSource = useMemo<DataTableDataSource<Row>>(() => ({
  key: "id",
  async load(options, { signal }) {
    const query = serializeLoadOptions(options, {
      parameterNames: { take: "limit", skip: "offset" },
    });
    const response = await fetch(\`/api/rows?\${query}\`, { signal });
    return response.json();
  },
}), []);

<DataTable
  ref={tableRef}
  dataSource={dataSource}
  remoteOperations
  defaultGrouping={["category", "city"]}
  initialPageSize={5}
  pageSizeOptions={[5, 10, 20]}
  itemLabel="kayıt"
/>

<button onClick={() => void tableRef.current?.reload()}>
  Yenile
</button>`;

export const MAPPED_CODE = `import { DataTable } from "modern-dt-pro";

<DataTable
  data={rows}
  title="Değer etiketleri"
  excludeColumns={["id"]}
  columnLabels={COLUMN_LABELS}
  valueMappers={{
    status: { 0: "Açık", 1: "Tamamlandı", 2: "İptal" },
  }}
/>`;

export const TEMPLATE_CODE = `import { DataTable } from "modern-dt-pro";

<DataTable
  data={rows}
  excludeColumns={["id"]}
  defaultGrouping={["category"]}
  aggregate={{ total: "sum" }}
  headerTemplate={{
    name: () => <strong>Özel başlık</strong>,
  }}
  cellTemplate={{
    active: ({ getValue }) => (
      <span>{getValue() ? "Aktif" : "Pasif"}</span>
    ),
  }}
  grupCellTemplate={{
    total: ({ getValue }) => (
      <strong>{Number(getValue()).toLocaleString("tr-TR")}</strong>
    ),
  }}
/>`;

export const VISIBLE_CODE = `import { DataTable } from "modern-dt-pro";

<DataTable
  data={rows}
  title="Görünür kolonlar"
  visibleColumns={["createdAt", "code", "name", "total"]}
  columnLabels={COLUMN_LABELS}
/>`;

export const EMPTY_CODE = `import { DataTable } from "modern-dt-pro";

<DataTable
  data={[]}
  title="Boş tablo"
  columnLabels={COLUMN_LABELS}
  emptyMessage="Gösterilecek kayıt yok"
/>`;

export const SQL_CODE = `import { DataTable } from "modern-dt-pro";

<DataTable
  data={rows}
  title="SQL sorgusu"
  excludeColumns={["id"]}
  columnLabels={COLUMN_LABELS}
  sqlQuery={SAMPLE_SQL}
/>`;
