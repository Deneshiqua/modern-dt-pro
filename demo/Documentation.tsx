type PropRow = {
  name: string;
  type: string;
  def: string;
  desc: string;
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="docs-code">
      <code>{children}</code>
    </pre>
  );
}

function PropTable({ rows }: { rows: PropRow[] }) {
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">
        <thead>
          <tr>
            <th>Prop</th>
            <th>Tip</th>
            <th>Varsayılan</th>
            <th>Açıklama</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.name}>
              <td>
                <code>{item.name}</code>
              </td>
              <td>
                <code>{item.type}</code>
              </td>
              <td>{item.def}</td>
              <td>{item.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Documentation() {
  return (
    <div className="docs">
      <nav className="docs-toc">
        <a href="#kurulum">Kurulum</a>
        <a href="#ozellikler">Özellikler</a>
        <a href="#kullanim">Kullanım</a>
        <a href="#props">Props</a>
        <a href="#kolonlar">Kolonlar</a>
        <a href="#templateler">Template'ler</a>
        <a href="#gruplama">Gruplama</a>
        <a href="#gorunum">Görünüm</a>
        <a href="#filtre">Filtre</a>
        <a href="#secim">Seçim</a>
        <a href="#sayfalama">Sayfalama</a>
        <a href="#export">Export</a>
        <a href="#sql">SQL</a>
        <a href="#bildirim">Bildirim</a>
        <a href="#yardimcilar">Yardımcılar</a>
        <a href="#tipler">Tipler</a>
        <a href="#tema">Tema</a>
      </nav>

      <section className="card docs-section" id="kurulum">
        <h2>Kurulum</h2>
        <p>Paket henüz npm'e yayınlanmadı. Yerel klasörden bağla:</p>
        <CodeBlock>{`pnpm add modern-dt-pro
# veya yerel:
pnpm add ../packages/modern-dt-pro`}
        </CodeBlock>
        <h3>Stil</h3>
        <p>
          Tailwind v4 kullanan uygulamada paket kaynaklarını tarat. Tema token'ları
          yoksa aşağıdaki CSS yeter:
        </p>
        <CodeBlock>{`import "modern-dt-pro/styles.css";`}
        </CodeBlock>
        <CodeBlock>{`@source "../node_modules/modern-dt-pro/dist";
@import "modern-dt-pro/styles.css";`}
        </CodeBlock>
      </section>

      <section className="card docs-section" id="ozellikler">
        <h2>Özellikler</h2>
        <p>
          <code className="docs-code-inline">DataTable</code> kolonları veriden otomatik
          üretir. Toolbar, filtre, gruplama ve export tek bileşende gelir. Sıralama,
          filtre, kolon seçici, gruplama, export ve arama{" "}
          <code className="docs-code-inline">enable*</code> prop'larıyla açılıp kapanır.
        </p>
        <ul className="docs-list">
          {FEATURES.map((item) => (
            <li key={item.title}>
              <strong>{item.title}.</strong> {item.desc}
            </li>
          ))}
        </ul>
      </section>

      <section className="card docs-section" id="kullanim">
        <h2>Kullanım</h2>
        <p>
          Satırlar düz nesne olmalı. Anahtarlar kolon id'si olur.{" "}
          <code className="docs-code-inline">id</code> gibi alanları{" "}
          <code className="docs-code-inline">excludeColumns</code> ile gizle.
        </p>
        <CodeBlock>{`import { DataTable } from "modern-dt-pro";
import "modern-dt-pro/styles.css";

<DataTable
  data={rows}
  title="Kayıtlar"
  excludeColumns={["id"]}
  enableRowSelection
  columnLabels={{ name: "Ad" }}
  valueMappers={{ status: { 0: "Taslak", 1: "Aktif" } }}
/>`}
        </CodeBlock>
      </section>

      <section className="card docs-section" id="props">
        <h2>Props</h2>
        <p>Tüm <code className="docs-code-inline">DataTable</code> parametreleri:</p>
        <h3>Veri ve görünüm</h3>
        <PropTable rows={DATA_PROPS} />
        <h3>Kolon kontrolü</h3>
        <PropTable rows={COLUMN_PROPS} />
        <h3>Gruplama ve sıralama</h3>
        <PropTable rows={GROUP_PROPS} />
        <h3>Filtre ve arama</h3>
        <PropTable rows={FILTER_PROPS} />
        <h3>Export</h3>
        <PropTable rows={EXPORT_PROPS} />
        <h3>Satır seçimi</h3>
        <PropTable rows={SELECTION_PROPS} />
        <h3>Sayfalama</h3>
        <PropTable rows={PAGINATION_PROPS} />
        <h3>SQL, bildirim, toolbar</h3>
        <PropTable rows={MISC_PROPS} />
      </section>

      <section className="card docs-section" id="kolonlar">
        <h2>Kolonlar</h2>
        <p>
          Kolonlar ilk satırın anahtarlarından üretilir.{" "}
          <code className="docs-code-inline">visibleColumns</code> verilirse yalnızca
          bu liste başlangıçta görünür; kullanıcı Kolonları Seç ile değiştirebilir
          (<code className="docs-code-inline">{"enableColumnPicker={false}"}</code> ile
          seçici gizlenir).{" "}
          <code className="docs-code-inline">visibleColumns</code>,{" "}
          <code className="docs-code-inline">excludeColumns</code>'dan önceliklidir.
        </p>
        <CodeBlock>{`<DataTable
  data={rows}
  excludeColumns={["id", "internalKey"]}
  visibleColumns={["createdAt", "code", "total"]}
  columnLabels={{
    createdAt: "Oluşturma tarihi",
    code: "Kod",
    total: "Toplam",
  }}
  valueMappers={{
    status: { 0: "Taslak", 1: "Aktif", 2: "Arşivlendi" },
  }}
/>`}
        </CodeBlock>
        <p>
          Sayısal kolonlar otomatik sağa hizalanır. Checkbox seçim kolonu{" "}
          <code className="docs-code-inline">enableRowSelection</code> açıkken eklenir.
        </p>
        <p>
          Kolon başlığının sağ kenarını sürükleyerek genişlik ayarlanır.{" "}
          <code className="docs-code-inline">enableColumnResizing</code> veya Tablo
          Görünümü menüsündeki <strong>Kolon genişliği</strong> ile açılır. Açılınca
          her kolon başlık (ikonlar ve filtre dahil) ve satır metnine göre ölçülür.{" "}
          <code className="docs-code-inline">fitColumns</code> açıkken kolonlar tablo
          genişliğine orantılı dağılır; kapalıyken içerik genişlikleri korunur ve
          yatay kaydırma kullanılır. Kenardan sürükleyerek daraltıp genişletebilirsin.
          Çift tıklama o kolonu yeniden içeriğe sığdırır.
        </p>
        <CodeBlock>{`<DataTable
  data={rows}
  enableColumnResizing
/>`}
        </CodeBlock>
      </section>

      <section className="card docs-section" id="templateler">
        <h2>Kolon template'leri</h2>
        <p>
          Template prop'ları kolon id'sini renderer fonksiyonuna eşler. Fonksiyonlar
          TanStack <code className="docs-code-inline">CellContext</code> veya{" "}
          <code className="docs-code-inline">HeaderContext</code> alır; değer, satır,
          kolon ve tablo bilgisine doğrudan erişilebilir.
        </p>
        <ul className="docs-list">
          <li>
            <code className="docs-code-inline">cellTemplate</code>: Normal veri
            hücresini özelleştirir.
          </li>
          <li>
            <code className="docs-code-inline">grupCellTemplate</code>: Grup başlık
            hücresi ve aggregate hücrelerini özelleştirir.
          </li>
          <li>
            <code className="docs-code-inline">headerTemplate</code>: Kolon başlığını
            özelleştirir; sıralama ve filtre kontrolleri korunur.
          </li>
        </ul>
        <CodeBlock>{`<DataTable
  data={rows}
  defaultGrouping={["category"]}
  aggregate={{ total: "sum" }}
  headerTemplate={{
    name: () => <strong>Özel başlık</strong>,
  }}
  cellTemplate={{
    active: ({ getValue, row }) => (
      <span title={row.original.name}>
        {getValue() ? "Aktif" : "Pasif"}
      </span>
    ),
  }}
  grupCellTemplate={{
    total: ({ getValue }) => (
      <strong>{Number(getValue()).toLocaleString("tr-TR")}</strong>
    ),
  }}
/>`}
        </CodeBlock>
        <p>
          Gruplama kolonunun kendi <code className="docs-code-inline">grupCellTemplate</code>{" "}
          renderer'ı verilirse varsayılan aç/kapat butonu da değiştirilir. Gerekirse{" "}
          <code className="docs-code-inline">context.row.getToggleExpandedHandler()</code>{" "}
          ile özel butona bağlanmalıdır.
        </p>
      </section>

      <section className="card docs-section" id="gruplama">
        <h2>Gruplama</h2>
        <p>
          Kolon başlığını üstteki alana sürükleyerek grupla. Sıra değiştirilebilir.
          Grup kolonunu yatay kaydırmada sabitleme butonu vardır.{" "}
          <code className="docs-code-inline">{"enableGrouping={false}"}</code> sürükleme
          alanını ve sabitleme butonunu kapatır.{" "}
          <code className="docs-code-inline">{"enableSorting={false}"}</code> başlık
          tıklayarak sıralamayı kapatır.
        </p>
        <CodeBlock>{`<DataTable
  data={rows}
  defaultGrouping={["category"]}
  defaultSorting={[{ id: "createdAt", desc: false }]}
  hideInGroupRow={["description"]}
/>`}
        </CodeBlock>
        <p>
          Aggregate işlemi varsayılan olarak yapılmaz. Yalnızca{" "}
          <code className="docs-code-inline">aggregate</code> içinde tanımlanan
          kolonlar hesaplanır. Hazır değerler{" "}
          <code className="docs-code-inline">sum | avg | count</code>; özel bir
          TanStack <code className="docs-code-inline">AggregationFn</code> de
          verilebilir.{" "}
          <code className="docs-code-inline">hideInGroupRow</code> listedeki kolonlar
          grup ve genel toplam satırında boş kalır.
        </p>
        <CodeBlock>{`<DataTable
  data={rows}
  defaultGrouping={["category"]}
  aggregate={{
    quantity: "sum",
    total: "sum",
    score: "avg",
    code: "count",
  }}
/>`}
        </CodeBlock>
      </section>

      <section className="card docs-section" id="gorunum">
        <h2>Tablo görünümü</h2>
        <p>
          Toolbar'daki ayar butonu <strong>Tablo Görünümü</strong> menüsünü açar.
          Görünüm: Tam Ekran, Satırları Sıkıştır, Kolon Çizgileri, Başlığı Sabitle,
          Sanal kaydırma.
          Özellikler: Satır seçimi, Kolon sıralama, Kolon filtresi, Kolon başlık
          filtresi, Kolon seçici, Kolon genişliği, Gruplama, Grupları Genişlet,
          Excel indir, JSON indir, Arama, Tablo başlığı.
        </p>
        <CodeBlock>{`<DataTable
  data={rows}
  defaultViewSettings={{
    rowDense: true,
    columnBorders: true,
    stickyHeader: true,
  }}
/>`}
        </CodeBlock>
        <p>
          Menüyü gizlemek için{" "}
          <code className="docs-code-inline">{"enableTableViewMenu={false}"}</code>.
        </p>
      </section>

      <section className="card docs-section" id="filtre">
        <h2>Filtre ve arama</h2>
        <p>
          Toolbar'daki arama tüm kolonlarda fuzzy arar. Her kolon başlığında metin
          filtresi ve değer (facet) filtresi vardır. Hepsi ayrı prop ile kapatılır:{" "}
          <code className="docs-code-inline">enableSearch</code>,{" "}
          <code className="docs-code-inline">enableColumnFilter</code>,{" "}
          <code className="docs-code-inline">enableColumnHeaderFilter</code>.
        </p>
        <p>Metin operatörleri:</p>
        <ul className="docs-list">
          <li><code className="docs-code-inline">contains</code> — içeren</li>
          <li><code className="docs-code-inline">notContains</code> — içermeyen</li>
          <li><code className="docs-code-inline">startsWith</code> — ile başlar</li>
          <li><code className="docs-code-inline">endsWith</code> — ile biter</li>
          <li><code className="docs-code-inline">equals</code> — eşittir</li>
          <li><code className="docs-code-inline">notEquals</code> — eşit değil</li>
        </ul>
        <p>
          Kontrollü kullanım için <code className="docs-code-inline">columnFilters</code>{" "}
          ve <code className="docs-code-inline">onColumnFiltersChange</code> ver.
        </p>
        <CodeBlock>{`const [filters, setFilters] = useState([]);

<DataTable
  data={rows}
  columnFilters={filters}
  onColumnFiltersChange={setFilters}
/>`}
        </CodeBlock>
      </section>

      <section className="card docs-section" id="secim">
        <h2>Satır seçimi</h2>
        <p>
          <code className="docs-code-inline">enableRowSelection</code> satır ve grup
          checkbox'larını açar. Seçim değişince{" "}
          <code className="docs-code-inline">onSelectionChange</code> seçili veri
          satırlarını verir (grup satırları hariç).
        </p>
        <CodeBlock>{`<DataTable
  data={rows}
  enableRowSelection
  onSelectionChange={setSelected}
  onDeleteSelected={handleDelete}
  deleteSelectedPopoverDescription={\`\${selected.length} kayıt silinecek.\`}
  isDeleteSelectedDisabled={selected.length === 0}
  onTransferSelected={handleTransfer}
  transferSelectedPopoverDescription={\`\${selected.length} kayıt aktarılacak.\`}
  isTransferSelectedDisabled={selected.length === 0}
/>`}
        </CodeBlock>
        <p>
          Sil ve aktar butonları yalnızca ilgili callback verilirse ve en az bir
          satır seçiliyse görünür. Onay popover'ı vardır.
        </p>
      </section>

      <section className="card docs-section" id="sayfalama">
        <h2>Sayfalama</h2>
        <p>
          Varsayılan istemci sayfalamasıdır (10 / 20 / 50 / 100 / 250 / 500). Dikey
          kaydırma yalnızca <code className="docs-code-inline">tbody</code> içindedir;
          başlık ve sayfalama sabit kalır.
        </p>
        <p>
          Çok satırlı sayfalarda DOM yükünü düşürmek için{" "}
          <code className="docs-code-inline">enableVirtualization</code> veya Tablo
          Görünümü menüsündeki <strong>Sanal kaydırma</strong> kullanılır. Yalnızca
          görünür satırlar (ve overscan) render edilir. Grup, seçim ve toplam
          satırları çalışmaya devam eder. En iyi sonuç için başlığı sabit tutun ve
          sayfa boyutunu yükseltin.
        </p>
        <CodeBlock>{`<DataTable
  data={rows}
  enableVirtualization
  defaultViewSettings={{ stickyHeader: true }}
/>`}
        </CodeBlock>
        <p>
          Sunucu sayfalaması için <code className="docs-code-inline">type="server"</code>,{" "}
          <code className="docs-code-inline">pagination</code>,{" "}
          <code className="docs-code-inline">onPaginationChange</code> ve{" "}
          <code className="docs-code-inline">totalRowCount</code> birlikte verilmelidir.
        </p>
        <CodeBlock>{`<DataTable
  type="server"
  data={pageRows}
  pagination={pagination}
  onPaginationChange={setPagination}
  totalRowCount={total}
/>`}
        </CodeBlock>
        <p>
          <code className="docs-code-inline">maxHeight</code> tablo gövdesinin tavan
          yüksekliğidir. <code className="docs-code-inline">"auto"</code> (varsayılan)
          ise bileşen kapsayıcıyı doldurur.
        </p>
      </section>

      <section className="card docs-section" id="export">
        <h2>Export</h2>
        <p>
          Toolbar'da Excel ve JSON indirme vardır.{" "}
          <code className="docs-code-inline">enableExcelExport</code> ve{" "}
          <code className="docs-code-inline">enableJsonExport</code> ile ayrı ayrı
          kapatılır. Kapsam: seçilen veya tümü. Mod:{" "}
          <code className="docs-code-inline">table</code> (görünen etiketler) veya{" "}
          <code className="docs-code-inline">raw</code> (ham değer).
        </p>
        <ul className="docs-list">
          <li>
            <code className="docs-code-inline">ExportScope</code>:{" "}
            <code className="docs-code-inline">"selected" | "all"</code>
          </li>
          <li>
            <code className="docs-code-inline">ExportMode</code>:{" "}
            <code className="docs-code-inline">"table" | "raw"</code>
          </li>
        </ul>
        <p>
          Dosya adı <code className="docs-code-inline">title</code> değerinden üretilir.
          Seçili satır yokken "seçileni indir" uyarı bildirimi verir.
        </p>
      </section>

      <section className="card docs-section" id="sql">
        <h2>SQL sorgusu</h2>
        <p>
          <code className="docs-code-inline">sqlQuery</code> doluysa toolbar'da sorgu
          ikonu çıkar. Tıklayınca metin gösterilir, kopyalanabilir.
        </p>
        <CodeBlock>{`<DataTable
  data={rows}
  sqlQuery="SELECT * FROM demo_records WHERE created_at >= '2026-01-01'"
/>`}
        </CodeBlock>
      </section>

      <section className="card docs-section" id="bildirim">
        <h2>Bildirim</h2>
        <p>
          Export, kopyalama ve seçim uyarıları{" "}
          <code className="docs-code-inline">onNotify</code> veya global{" "}
          <code className="docs-code-inline">setDataTableNotify</code> ile iletilir.
          Tip: <code className="docs-code-inline">success | error | warning</code>.
        </p>
        <CodeBlock>{`import { toast } from "sonner";
import { setDataTableNotify } from "modern-dt-pro";

setDataTableNotify((type, message) => toast[type](message));

// veya tek tablo:
<DataTable data={rows} onNotify={(type, message) => toast[type](message)} />`}
        </CodeBlock>
      </section>

      <section className="card docs-section" id="yardimcilar">
        <h2>Filtre yardımcıları</h2>
        <p>
          Kolon filtrelerini SQL'e çevirmek veya özel kolon başlığı yazmak için:
        </p>
        <PropTable rows={HELPER_PROPS} />
        <CodeBlock>{`import {
  columnFilter,
  buildColumnFilterSqlClause,
  getCellFilterMeta,
  BLANK_FILTER_ID,
} from "modern-dt-pro";

const sql = buildColumnFilterSqlClause(
  "category",
  filterValue,
  (value) => value.replaceAll("'", "''"),
  (columnId) => columnId,
);`}
        </CodeBlock>
        <p>
          <code className="docs-code-inline">BLANK_FILTER_ID</code> değeri{" "}
          <code className="docs-code-inline">"__blank__"</code>. Boş hücre facet
          seçiminde bu id kullanılır.
        </p>
        <p>
          <code className="docs-code-inline">FacetColumnFilter</code> ve{" "}
          <code className="docs-code-inline">TextColumnFilter</code> kendi kolon
          başlığını yazarken de kullanılabilir; DataTable bunları varsayılan olarak
          bağlar.
        </p>
      </section>

      <section className="card docs-section" id="tipler">
        <h2>Tipler</h2>
        <PropTable rows={TYPE_ROWS} />
        <CodeBlock>{`type ColumnFilterValue = {
  facetValues?: string[] | null;
  textFilter?: {
    operator: TextFilterOperator;
    value: string;
  } | null;
};

type SortingState = { id: string; desc: boolean }[];
type PaginationState = { pageIndex: number; pageSize: number };`}
        </CodeBlock>
      </section>

      <section className="card docs-section" id="tema">
        <h2>Tema</h2>
        <p>
          Tablo stilleri <code className="docs-code-inline">html.dark</code> sınıfına
          bakar. Koyu modda checkbox, kenarlık ve satır hover renkleri değişir.
        </p>
        <CodeBlock>{`<html class="dark">
  <DataTable data={rows} />
</html>`}
        </CodeBlock>
        <p>
          Kapsayıcıya yükseklik ver; tablo <code className="docs-code-inline">h-full</code>{" "}
          ile doldurur. Kaydırma gövde satırlarında çıkar.
        </p>
        <h3>toolbarExtra</h3>
        <p>Sağ toolbar'a özel düğme veya içerik eklemek için:</p>
        <CodeBlock>{`<DataTable
  data={rows}
  toolbarExtra={<button type="button">Yenile</button>}
/>`}
        </CodeBlock>
      </section>
    </div>
  );
}

const FEATURES = [
  {
    title: "Otomatik kolonlar",
    desc: "Nesne anahtarlarından kolon üretir; etiket ve görünürlük özelleştirilir.",
  },
  {
    title: "Gruplama",
    desc: "Başlığı sürükleyerek çok seviyeli grup, toplam satırı ve sabit grup kolonu.",
  },
  {
    title: "Filtre",
    desc: "Kolon başlığında facet ve metin operatörleri; global fuzzy arama.",
  },
  {
    title: "Seçim",
    desc: "Satır / grup checkbox, sil ve aktar onayları.",
  },
  {
    title: "Export",
    desc: "Excel ve JSON; seçilen veya tümü; görünen veya ham değer.",
  },
  {
    title: "Sayfalama",
    desc: "İstemci sayfası veya type=\"server\" ile sunucu sayfalaması.",
  },
  {
    title: "SQL",
    desc: "Toolbar'da sorgu gösterimi ve kopyalama.",
  },
  {
    title: "Kolon genişliği",
    desc: "Açılınca başlık ve hücre metnine göre otomatik genişlik; sürükleyerek daraltma, çift tık ile yeniden sığdırma.",
  },
  {
    title: "Kolonları sığdır",
    desc: "Açıkken kolonları tablo genişliğine orantılı dağıtır. Kapalıyken içerik genişliklerini korur ve yatay kaydırma gösterir.",
  },
  {
    title: "Tablo görünümü",
    desc: "Toolbar menüsünden tam ekran, sıkışık satır, kolon çizgileri, sanal kaydırma ve sabit başlık.",
  },
  {
    title: "Kaydırma",
    desc: "Dikey scroll tbody içinde; başlık ve sayfalama sabit. Sanal kaydırma açıkken yalnızca görünür satırlar DOM'da tutulur.",
  },
];

const DATA_PROPS: PropRow[] = [
  { name: "data", type: "T[]", def: "—", desc: "Tablo satırları. Zorunlu." },
  { name: "title", type: "string", def: "—", desc: "Toolbar başlığı ve export dosya adı kökü." },
  { name: "emptyMessage", type: "string", def: '"Gösterilecek veri bulunamadı"', desc: "data boşken tbody metni." },
  { name: "maxHeight", type: "string", def: '"auto"', desc: "Gövde tavan yüksekliği. auto ise kapsayıcıyı doldurur." },
  { name: "type", type: '"server" | "portal" | null', def: "null", desc: "server + pagination + totalRowCount ile sunucu sayfalaması." },
  { name: "toolbarExtra", type: "ReactNode", def: "—", desc: "Sağ toolbar'a ek içerik." },
  { name: "enableTableViewMenu", type: "boolean", def: "true", desc: "Toolbar Tablo Görünümü menüsü. Görünüm ve özellik anahtarlarını içerir." },
  { name: "enableVirtualization", type: "boolean", def: "false", desc: "Görünen satırlar için sanal kaydırma. Tablo Görünümü menüsünden de açılır." },
  { name: "defaultViewSettings", type: "object", def: "bkz. açıklama", desc: "fullScreen false, rowDense false, columnBorders true, expandGroups true, stickyHeader true, virtualization enableVirtualization, columnResizing enableColumnResizing, fitColumns fitColumns." },
];

const COLUMN_PROPS: PropRow[] = [
  { name: "excludeColumns", type: "(keyof T)[]", def: "[]", desc: "Kolon olarak üretilmez (ör. id)." },
  { name: "visibleColumns", type: "(keyof T)[]", def: "—", desc: "Başlangıçta görünen kolonlar. Verilirse diğerleri gizli başlar." },
  { name: "columnLabels", type: "Record<string, string>", def: "{}", desc: "Kolon id → başlık metni." },
  { name: "valueMappers", type: "Record<string, Record<string | number, string>>", def: "—", desc: "Ham hücre değeri → görünen etiket. Filtre ve export table modunda da kullanılır." },
  { name: "cellTemplate", type: "DataTableTemplateMap<T, DataTableCellTemplate<T>>", def: "—", desc: "Kolon bazlı normal hücre renderer'ları." },
  { name: "grupCellTemplate", type: "DataTableTemplateMap<T, DataTableGroupCellTemplate<T>>", def: "—", desc: "Kolon bazlı grup ve aggregate hücre renderer'ları." },
  { name: "headerTemplate", type: "DataTableTemplateMap<T, DataTableHeaderTemplate<T>>", def: "—", desc: "Kolon bazlı başlık renderer'ları." },
  { name: "aggregate", type: "DataTableTemplateMap<T, DataTableAggregate<T>>", def: "—", desc: "Kolon bazlı aggregate işlemi. Tanımlanmayan kolonlarda hesaplama yapılmaz." },
  { name: "enableColumnPicker", type: "boolean", def: "true", desc: "Toolbar'daki Kolonları Seç menüsü." },
  { name: "enableColumnResizing", type: "boolean", def: "true", desc: "Kolon başlığından sürükleyerek genişlik. Tablo Görünümü menüsünden de açılır." },
  { name: "fitColumns", type: "boolean", def: "true", desc: "Kolonları tablo genişliğine orantılı sığdırır. false ise içerik genişliği ve yatay scroll kullanılır." },
];

const GROUP_PROPS: PropRow[] = [
  { name: "enableSorting", type: "boolean", def: "true", desc: "Kolon başlığına tıklayarak sıralama ve sıralama ikonu." },
  { name: "enableGrouping", type: "boolean", def: "true", desc: "Sürükle-bırak gruplama alanı ve grup kolonunu sabitleme." },
  { name: "defaultGrouping", type: "string[]", def: "[]", desc: "Açılışta gruplanacak kolon id'leri." },
  { name: "defaultSorting", type: "SortingState", def: "[]", desc: "Açılış sıralaması. Örnek: [{ id: \"tarih\", desc: true }]." },
  { name: "hideInGroupRow", type: "string[]", def: "[]", desc: "Grup ve genel toplam satırında gizlenecek kolonlar." },
];

const FILTER_PROPS: PropRow[] = [
  { name: "enableSearch", type: "boolean", def: "true", desc: "Toolbar global arama." },
  { name: "enableColumnFilter", type: "boolean", def: "true", desc: "Kolon başlığı altındaki metin filtresi." },
  { name: "enableColumnHeaderFilter", type: "boolean", def: "true", desc: "Kolon başlığındaki değer (facet) filtresi." },
  { name: "columnFilters", type: "ColumnFiltersState", def: "—", desc: "Kontrollü kolon filtreleri. Yoksa dahili state kullanılır." },
  { name: "onColumnFiltersChange", type: "(filters: ColumnFiltersState) => void", def: "—", desc: "Kolon filtresi değişince." },
];

const EXPORT_PROPS: PropRow[] = [
  { name: "enableExcelExport", type: "boolean", def: "true", desc: "Toolbar Excel indirme menüsü." },
  { name: "enableJsonExport", type: "boolean", def: "true", desc: "Toolbar JSON indirme menüsü." },
];

const SELECTION_PROPS: PropRow[] = [
  { name: "enableRowSelection", type: "boolean", def: "false", desc: "Satır ve grup checkbox'ları." },
  { name: "onSelectionChange", type: "(rows: T[]) => void", def: "—", desc: "Seçilen veri satırları (grup satırı yok)." },
  { name: "onDeleteSelected", type: "() => void | Promise<void>", def: "—", desc: "Seçilenleri sil. Verilirse sil butonu çıkar." },
  { name: "deleteSelectedPopoverDescription", type: "ReactNode", def: '"N seçili kayıt silinecek..."', desc: "Sil onay metni." },
  { name: "isDeleteSelectedDisabled", type: "boolean", def: "false", desc: "Sil butonunu kilitle." },
  { name: "onTransferSelected", type: "() => void | Promise<void>", def: "—", desc: "Seçilenleri aktar. Verilirse aktar butonu çıkar." },
  { name: "transferSelectedPopoverDescription", type: "ReactNode", def: '"N seçili kayıt aktarılacak..."', desc: "Aktar onay metni." },
  { name: "isTransferSelectedDisabled", type: "boolean", def: "false", desc: "Aktar butonunu kilitle." },
];

const PAGINATION_PROPS: PropRow[] = [
  { name: "pagination", type: "PaginationState", def: "{ pageIndex: 0, pageSize: 10 }", desc: "Kontrollü sayfa. type=\"server\" ve totalRowCount ile sunucu modu." },
  { name: "onPaginationChange", type: "(pagination: PaginationState) => void", def: "—", desc: "Sayfa veya sayfa boyutu değişince." },
  { name: "totalRowCount", type: "number", def: "—", desc: "Sunucu sayfalamasında toplam kayıt sayısı." },
];

const MISC_PROPS: PropRow[] = [
  { name: "sqlQuery", type: "string", def: "—", desc: "Toolbar'da SQL gösterimi ve kopyalama." },
  { name: "onNotify", type: "NotifyFn", def: "—", desc: "(type, message) => void. Yoksa setDataTableNotify veya console." },
];

const HELPER_PROPS: PropRow[] = [
  { name: "columnFilter", type: "FilterFn<any>", def: "—", desc: "TanStack kolon filterFn. Facet + metin operatörleri." },
  { name: "buildColumnFilterSqlClause", type: "(columnId, filterValue, escapeSqlValue, buildSqlColumnName) => string | null", def: "—", desc: "Filtre değerinden SQL WHERE parçası üretir." },
  { name: "getCellFilterMeta", type: "(columnId, rawValue, valueMappers?) => { id, label, isBlank }", def: "—", desc: "Facet id/etiket. Boş değer için BLANK_FILTER_ID." },
  { name: "BLANK_FILTER_ID", type: "string", def: '"__blank__"', desc: "Boş hücre facet id'si." },
  { name: "setDataTableNotify", type: "(fn: NotifyFn) => void", def: "—", desc: "Uygulama geneli toast bağlama." },
  { name: "FacetColumnFilter", type: "component", def: "—", desc: "Kolon başlığı değer filtresi." },
  { name: "TextColumnFilter", type: "component", def: "—", desc: "Kolon başlığı metin filtresi." },
];

const TYPE_ROWS: PropRow[] = [
  { name: "DataTableProps<T>", type: "interface", def: "—", desc: "DataTable prop tipi." },
  { name: "DataTableCellTemplate<T>", type: "(CellContext<T, unknown>) => ReactNode", def: "—", desc: "Normal hücre renderer tipi." },
  { name: "DataTableGroupCellTemplate<T>", type: "(CellContext<T, unknown>) => ReactNode", def: "—", desc: "Grup hücresi renderer tipi." },
  { name: "DataTableHeaderTemplate<T>", type: "(HeaderContext<T, unknown>) => ReactNode", def: "—", desc: "Başlık renderer tipi." },
  { name: "DataTableAggregate<T>", type: '"sum" | "avg" | "count" | AggregationFn<T>', def: "—", desc: "Kolon aggregate tanımı." },
  { name: "DataTableTemplateMap<T, TTemplate>", type: "Partial<Record<keyof T, TTemplate>>", def: "—", desc: "Kolon id → template eşlemesi." },
  { name: "TableViewSettings", type: "object", def: "—", desc: "Görünüm ve özellik anahtarları (tam ekran, sanal kaydırma, sıralama, filtre, export, arama vb.)." },
  { name: "DataTableType", type: '"server" | "portal" | null', def: "—", desc: "Tablo çalışma kipi." },
  { name: "TextFilterOperator", type: "union", def: "—", desc: "contains | notContains | startsWith | endsWith | equals | notEquals." },
  { name: "ColumnFilterValue", type: "object", def: "—", desc: "facetValues ve textFilter." },
  { name: "ExportScope", type: '"selected" | "all"', def: "—", desc: "İndirme kapsamı." },
  { name: "ExportMode", type: '"table" | "raw"', def: "—", desc: "Görünen etiket veya ham değer." },
  { name: "ExportOptions", type: "object", def: "—", desc: "scope, mode, valueMappers." },
  { name: "NotifyFn", type: "(type, message) => void", def: "—", desc: "Bildirim fonksiyonu." },
  { name: "NotifyType", type: '"success" | "error" | "warning"', def: "—", desc: "Bildirim tipi." },
];
