export type NotifyType = "success" | "error" | "warning";
export type NotifyFn = (type: NotifyType, message: string) => void;

let notifyImpl: NotifyFn = (type, message) => {
  if (typeof console === "undefined") return;
  if (type === "error") {
    console.error(message);
    return;
  }
  console.warn(message);
};

/** Uygulama toast kutuphanesini baglamak icin (ornek: sonner). */
export function setDataTableNotify(fn: NotifyFn) {
  notifyImpl = fn;
}

export function notify(type: NotifyType, message: string, override?: NotifyFn) {
  (override ?? notifyImpl)(type, message);
}
