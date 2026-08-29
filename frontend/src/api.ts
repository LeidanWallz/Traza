import { API_BASE_URL } from "./config";
import { getTenantId } from "./tenant";
import type { Excepcion, PadronCliente, PadronProducto, PadronUbicacion, PadronUnidad, Trip } from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "x-tenant-id": getTenantId(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return res.json();
}

export const api = {
  trips: {
    list: (estado?: string) => req<Trip[]>(`/trips${estado ? `?estado=${estado}` : ""}`),
    get: (id: string) => req<Trip>(`/trips/${id}`),
    crear: (form: FormData) => req<Trip>("/trips", { method: "POST", body: form }),
    entrega: (id: string, form: FormData) => req<Trip>(`/trips/${id}/entrega`, { method: "POST", body: form }),
    conciliar: (id: string) => req<Trip>(`/trips/${id}/conciliar`, { method: "POST" }),
  },
  excepciones: {
    list: (estado = "ABIERTA") => req<Excepcion[]>(`/excepciones?estado=${estado}`),
    liberar: (id: string, estadoPrevio: "EN_TRANSITO" | "ENTREGADO") =>
      req<Trip>(`/excepciones/${id}/liberar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ estadoPrevio }),
      }),
    rechazar: (id: string) => req<Excepcion>(`/excepciones/${id}/rechazar`, { method: "POST" }),
  },
  padron: {
    unidades: () => req<PadronUnidad[]>("/padron/unidades"),
    productos: () => req<PadronProducto[]>("/padron/productos"),
    ubicaciones: () => req<PadronUbicacion[]>("/padron/ubicaciones"),
    clientes: () => req<PadronCliente[]>("/padron/clientes"),
  },
};
