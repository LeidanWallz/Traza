// Cola offline (§3, §7): el chofer puede estar sin señal en la cantera o en
// obra. Las capturas (origen/entrega) se guardan en IndexedDB con su foto y
// se reintentan solas cuando vuelve la conexión — la UI nunca bloquea la
// captura por falta de señal.
import { api } from "./api";

const DB_NAME = "traza-offline";
const STORE = "pending";

interface Pendiente {
  id: number;
  kind: "origen" | "entrega";
  tripId?: string;
  fields: Record<string, string>;
  fileBlob: Blob;
  fileName: string;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function encolarCaptura(
  kind: Pendiente["kind"],
  fields: Record<string, string>,
  file: File,
  tripId?: string
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({
      kind,
      tripId,
      fields,
      fileBlob: file,
      fileName: file.name,
      createdAt: Date.now(),
    } satisfies Omit<Pendiente, "id">);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function contarPendientes(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function todos(): Promise<Pendiente[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as Pendiente[]);
    req.onerror = () => reject(req.error);
  });
}

async function eliminar(id: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Reintenta cada captura pendiente contra la API. Silencioso si sigue sin señal. */
export async function sincronizarPendientes(): Promise<void> {
  if (!navigator.onLine) return;
  const pendientes = await todos();
  for (const p of pendientes) {
    try {
      const form = new FormData();
      for (const [k, v] of Object.entries(p.fields)) form.set(k, v);
      form.set("foto", p.fileBlob, p.fileName);

      if (p.kind === "origen") {
        await api.trips.crear(form);
      } else if (p.kind === "entrega" && p.tripId) {
        await api.trips.entrega(p.tripId, form);
      }
      await eliminar(p.id);
    } catch {
      // Sigue en la cola, se reintenta en el próximo online/heartbeat.
    }
  }
}
