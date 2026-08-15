# Modern DataTable Pro

Modern DataTable Pro; gruplama, kolon filtreleri, satır seçimi, Excel/JSON export ve sticky kolon destekli React tablosudur.

Bu paket henüz npm'e yayınlanmadı.

## Kurulum (yerel)

```bash
pnpm add ../path/to/modern-dt-pro
# veya paket klasöründe:
pnpm install
pnpm build
```

## Kullanım

```tsx
import { DataTable } from "modern-dt-pro";
import "modern-dt-pro/styles.css";

<DataTable
  data={rows}
  title="Kayıtlar"
  enableRowSelection
  columnLabels={{ name: "Ad" }}
/>
```

## Kolon template'leri

```tsx
<DataTable
  data={rows}
  aggregate={{ total: "sum" }}
  headerTemplate={{
    name: () => <strong>Özel başlık</strong>,
  }}
  cellTemplate={{
    active: ({ getValue }) => <span>{getValue() ? "Aktif" : "Pasif"}</span>,
  }}
  grupCellTemplate={{
    total: ({ getValue }) => <strong>{Number(getValue()).toLocaleString("tr-TR")}</strong>,
  }}
/>
```

Template fonksiyonları TanStack `CellContext` veya `HeaderContext` alır.

Gruplamada otomatik aggregate yapılmaz. Yalnızca `aggregate` içinde tanımlanan
kolonlar için `sum`, `avg`, `count` veya özel bir TanStack `AggregationFn`
çalıştırılır.

Tailwind v4 kullanan uygulamada paket dosyalarını tarat:

```css
@source "../node_modules/modern-dt-pro/dist";
@import "modern-dt-pro/styles.css";
```

`primary` / `dark-*` token'ları olan bir temada `styles.css` opsiyoneldir.

## Toast bağlama

```tsx
import { toast } from "sonner";
import { setDataTableNotify } from "modern-dt-pro";

setDataTableNotify((type, message) => toast[type](message));
```

## Demo

Paket içinde bağımsız bir Vite sayfası var. Kaynak kodu doğrudan `src/` üzerinden yükler.

```bash
cd packages/modern-dt-pro
pnpm install --ignore-workspace
pnpm demo
```

Tarayıcı `http://localhost:5174` adresinde açılır. Gruplama, filtre, export, satır seçimi, SQL görünümü ve sil/aktar aksiyonları genel amaçlı dummy verilerle denenebilir.

## Build

```bash
pnpm build
```

Çıktı: `dist/index.js` + `dist/index.d.ts`
