// Vite'in `?worker` icerik aktarimi: modul bir Worker sinifi dondurur.
declare module "*?worker" {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}
