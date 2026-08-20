import { useMemo, useState } from "react";

import { DataTable, type NotifyType } from "modern-dt-pro";
import { ExampleFrame } from "./ExampleFrame";
import { createRemoteDemoDataSource } from "./remoteDataSource";
import {
  BASIC_CODE,
  CONTROLLED_SERVER_CODE,
  EMPTY_CODE,
  GROUPED_CODE,
  MAPPED_CODE,
  SELECTION_CODE,
  SQL_CODE,
  TEMPLATE_CODE,
  VISIBLE_CODE,
} from "./exampleCode";
import {
  COLUMN_LABELS,
  SAMPLE_SQL,
  VALUE_MAPPERS,
  createDemoRows,
  type DemoRow,
} from "./data";

type ExamplesProps = {
  onNotify: (type: NotifyType, message: string) => void;
};

export function Examples({ onNotify }: ExamplesProps) {
  const [rows, setRows] = useState<DemoRow[]>(() => createDemoRows());
  const [selected, setSelected] = useState<DemoRow[]>([]);
  const previewRows = useMemo(() => rows.slice(0, 16), [rows]);
  const serverSource = useMemo(() => createDemoRows(48), []);
  const remoteDataSource = useMemo(
    () => createRemoteDemoDataSource(serverSource),
    [serverSource],
  );

  const handleDeleteSelected = async () => {
    const ids = new Set(selected.map((row) => row.id));
    setRows((current) => current.filter((row) => !ids.has(row.id)));
    setSelected([]);
    onNotify("success", `${ids.size} kayıt silindi`);
  };

  const handleTransferSelected = async () => {
    onNotify("success", `${selected.length} kayıt aktarıldı`);
  };

  const handleServerRefresh = () => {
    onNotify("success", "Sunucu verileri yenilendi");
  };

  return (
    <div className="sections">
      <ExampleFrame
        title="Temel tablo"
        description="Kolonlar veriden otomatik üretilir. Filtre, arama ve export dahildir."
        code={BASIC_CODE}
      >
        <DataTable
          data={previewRows}
          title="Temel tablo"
          excludeColumns={["id"]}
          columnLabels={COLUMN_LABELS}
          onNotify={onNotify}
        />
      </ExampleFrame>

      <ExampleFrame
        title="Gruplama"
        description="Kolon başlığını üst alana bırakarak grupla. Varsayılan grup: kategori."
        code={GROUPED_CODE}
      >
        <DataTable
          data={previewRows}
          title="Kategoriye göre gruplu"
          excludeColumns={["id"]}
          columnLabels={COLUMN_LABELS}
          defaultGrouping={["category"]}
          defaultSorting={[{ id: "createdAt", desc: false }]}
          onNotify={onNotify}
        />
      </ExampleFrame>

      <ExampleFrame
        title="Satır seçimi"
        description="Checkbox ile çoklu seçim. Seçilen kayıtları sil veya aktar."
        code={SELECTION_CODE}
      >
        <DataTable
          data={rows}
          title="Satır seçimi"
          excludeColumns={["id"]}
          columnLabels={COLUMN_LABELS}
          valueMappers={VALUE_MAPPERS}
          enableRowSelection
          onSelectionChange={setSelected}
          onNotify={onNotify}
          onDeleteSelected={handleDeleteSelected}
          deleteSelectedPopoverDescription={`${selected.length} seçili kayıt silinecek. Onaylıyor musunuz?`}
          onTransferSelected={handleTransferSelected}
          transferSelectedPopoverDescription={`${selected.length} seçili kayıt aktarılacak. Onaylıyor musunuz?`}
        />
      </ExampleFrame>

      <ExampleFrame
        title="Remote DataSource ve lazy gruplama"
        description="Filtre, arama, sıralama ve sayfalama loadOptions ile çalışır. Kategori ve şehir grupları açıldıkça AbortSignal destekli olarak yüklenir."
        code={CONTROLLED_SERVER_CODE}
      >
        <DataTable
          dataSource={remoteDataSource}
          remoteOperations
          title="Remote ürün kayıtları"
          excludeColumns={["id"]}
          columnLabels={COLUMN_LABELS}
          defaultGrouping={["category", "city"]}
          defaultSorting={[{ id: "name", desc: false }]}
          enableRowSelection
          initialPageSize={5}
          pageSizeOptions={[5, 10, 20]}
          itemLabel="kayıt"
          onRefresh={handleServerRefresh}
          loadingText="Sunucu verileri yükleniyor..."
          onNotify={onNotify}
        />
      </ExampleFrame>

      <ExampleFrame
        title="Değer etiketleri"
        description="valueMappers ile ham değerleri okunur etiketlere çevir."
        code={MAPPED_CODE}
      >
        <DataTable
          data={previewRows}
          title="Değer etiketleri"
          excludeColumns={["id"]}
          columnLabels={COLUMN_LABELS}
          valueMappers={VALUE_MAPPERS}
          onNotify={onNotify}
        />
      </ExampleFrame>

      <ExampleFrame
        title="Özel template'ler"
        description="Başlık, normal hücre ve grup hücrelerini kolon bazında özelleştir."
        code={TEMPLATE_CODE}
      >
        <DataTable
          data={previewRows}
          title="Template örneği"
          excludeColumns={["id"]}
          columnLabels={COLUMN_LABELS}
          defaultGrouping={["category"]}
          aggregate={{ total: "sum" }}
          headerTemplate={{
            name: () => <strong className="text-primary-600">Özel başlık</strong>,
          }}
          cellTemplate={{
            active: ({ getValue }) => (
              <span
                className={
                  getValue()
                    ? "font-medium text-emerald-600"
                    : "font-medium text-rose-600"
                }
              >
                {getValue() ? "Aktif" : "Pasif"}
              </span>
            ),
          }}
          grupCellTemplate={{
            total: ({ getValue }) => (
              <strong className="text-primary-600">
                {Number(getValue()).toLocaleString("tr-TR", {
                  maximumFractionDigits: 2,
                })}
              </strong>
            ),
          }}
          onNotify={onNotify}
        />
      </ExampleFrame>

      <ExampleFrame
        title="Görünür kolonlar"
        description="visibleColumns sadece seçilen alanları başlangıçta gösterir."
        code={VISIBLE_CODE}
      >
        <DataTable
          data={previewRows}
          title="Görünür kolonlar"
          visibleColumns={["createdAt", "code", "name", "total"]}
          columnLabels={COLUMN_LABELS}
          onNotify={onNotify}
        />
      </ExampleFrame>

      <ExampleFrame
        title="SQL sorgusu"
        description="sqlQuery doluysa toolbar'da sorguyu göster ve kopyala."
        code={SQL_CODE}
      >
        <DataTable
          data={previewRows}
          title="SQL sorgusu"
          excludeColumns={["id"]}
          columnLabels={COLUMN_LABELS}
          sqlQuery={SAMPLE_SQL}
          onNotify={onNotify}
        />
      </ExampleFrame>

      <ExampleFrame
        title="Boş tablo"
        description="Veri yokken emptyMessage gösterilir."
        code={EMPTY_CODE}
        tableHeight="440px"
      >
        <DataTable
          data={[]}
          title="Boş tablo"
          columnLabels={COLUMN_LABELS}
          emptyMessage="Gösterilecek kayıt yok"
          onNotify={onNotify}
        />
      </ExampleFrame>
    </div>
  );
}
