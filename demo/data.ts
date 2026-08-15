export type DemoRow = {
  id: number;
  createdAt: string;
  code: string;
  name: string;
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  owner: string;
  department: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  priority: string;
  score: number;
  progress: number;
  active: boolean;
  tag: string;
  status: number;
};

const NAMES = [
  "Alpha kayıt",
  "Beta kayıt",
  "Gamma kayıt",
  "Delta kayıt",
  "Epsilon kayıt",
] as const;
const CATEGORIES = ["Kategori A", "Kategori B", "Kategori C", "Kategori D"] as const;
const OWNERS = ["Ayşe Kaya", "Mehmet Demir", "Elif Yıldız", "Can Öztürk"] as const;
const DEPARTMENTS = ["Operasyon", "Finans", "Satış", "Destek"] as const;
const CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa"] as const;
const PRIORITIES = ["Düşük", "Orta", "Yüksek", "Kritik"] as const;
const TAGS = ["Yeni", "Örnek", "Kontrol", "Arşiv"] as const;

function hash(value: number) {
  return (value * 9301 + 49297) % 233280;
}

function dateAt(offset: number) {
  const date = new Date("2026-01-01T00:00:00");
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export const SAMPLE_SQL = `SELECT
  created_at, code, name, category, description, quantity, unit_price,
  total, owner, department, email, phone, city, country, priority,
  score, progress, active, tag, status
FROM demo_records
WHERE created_at >= '2026-01-01'
ORDER BY created_at, code`;

export function createDemoRows(count = 16): DemoRow[] {
  return Array.from({ length: count }, (_, index) => {
    const seed = hash(index + 1);
    const quantity = 1 + (seed % 50);
    const unitPrice = Number((10 + (seed % 900) / 10).toFixed(2));

    return {
      id: index + 1,
      createdAt: dateAt(index),
      code: `REC-${String(index + 1).padStart(5, "0")}`,
      name: NAMES[seed % NAMES.length],
      category: CATEGORIES[(seed + index) % CATEGORIES.length],
      description: `Genel amaçlı örnek açıklama ${index + 1}`,
      quantity,
      unitPrice,
      total: Number((quantity * unitPrice).toFixed(2)),
      owner: OWNERS[(seed + 1) % OWNERS.length],
      department: DEPARTMENTS[(seed + 2) % DEPARTMENTS.length],
      email: `user${index + 1}@example.com`,
      phone: `+90 555 ${String(1000000 + (seed % 9000000)).slice(0, 7)}`,
      city: CITIES[(seed + 3) % CITIES.length],
      country: "Türkiye",
      priority: PRIORITIES[(seed + index) % PRIORITIES.length],
      score: seed % 101,
      progress: (seed * 3) % 101,
      active: seed % 3 !== 0,
      tag: TAGS[(seed + 1) % TAGS.length],
      status: seed % 11 === 0 ? 2 : seed % 5 === 0 ? 0 : 1,
    };
  });
}

export const COLUMN_LABELS: Record<string, string> = {
  createdAt: "Oluşturma tarihi",
  code: "Kod",
  name: "Ad",
  category: "Kategori",
  description: "Açıklama",
  quantity: "Miktar",
  unitPrice: "Birim fiyat",
  total: "Toplam",
  owner: "Sorumlu",
  department: "Birim",
  email: "E-posta",
  phone: "Telefon",
  city: "Şehir",
  country: "Ülke",
  priority: "Öncelik",
  score: "Puan",
  progress: "İlerleme",
  active: "Aktif",
  tag: "Etiket",
  status: "Durum",
};

export const VALUE_MAPPERS: Record<string, Record<string | number, string>> = {
  status: {
    0: "Taslak",
    1: "Aktif",
    2: "Arşivlendi",
  },
};
