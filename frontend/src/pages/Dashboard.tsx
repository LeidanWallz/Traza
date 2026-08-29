import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useTurnoEnVivo } from "../useTurnoEnVivo";
import type { EstadoViaje, Trip } from "../types";

const COLUMNAS: { estado: EstadoViaje; titulo: string }[] = [
  { estado: "EN_TRANSITO", titulo: "En tránsito" },
  { estado: "ENTREGADO", titulo: "Entregado" },
  { estado: "EXCEPCION", titulo: "Excepción" },
  { estado: "CONCILIADO", titulo: "Conciliado" },
];

export default function Dashboard() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conciliando, setConciliando] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api.trips
      .list()
      .then(setTrips)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(cargar, [cargar]);
  useTurnoEnVivo(cargar);

  async function conciliar(id: string) {
    setConciliando(id);
    try {
      await api.trips.conciliar(id);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConciliando(null);
    }
  }

  return (
    <>
      <h1>Turno en vivo</h1>
      <p className="subtitle">Viajes del tenant activo, actualizados en tiempo real.</p>
      {error && <div className="form-msg err" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="board">
        {COLUMNAS.map((col) => {
          const items = trips.filter((t) => t.estado === col.estado);
          return (
            <div className="column" key={col.estado}>
              <div className="column-header">
                <span className={`badge-${col.estado}`}>{col.titulo}</span>
                <span className="column-count">{items.length}</span>
              </div>
              <div className="column-body">
                {items.length === 0 && <div className="empty">Sin viajes</div>}
                {items.map((t) => (
                  <div className="card" key={t.id}>
                    <div className="card-folio">{t.folioOrigen ?? "(sin folio)"}</div>
                    <div className="card-row">
                      <span>{t.producto.nombre}</span>
                      <span>{t.unidad.identificador}</span>
                    </div>
                    <div className="card-row">
                      <span>{t.origen.nombre} → {t.destino.nombre}</span>
                    </div>
                    {t.neto != null && (
                      <div className="card-row">
                        <span>Neto</span>
                        <span>{t.neto.toLocaleString()} kg</span>
                      </div>
                    )}
                    {t.estado === "EXCEPCION" && t.excepciones.some((e) => e.estado === "ABIERTA") && (
                      <div className="card-row" style={{ color: "var(--danger)" }}>
                        {t.excepciones.find((e) => e.estado === "ABIERTA")?.tipo}
                      </div>
                    )}
                    {t.estado === "ENTREGADO" && (
                      <button className="card-btn secondary" onClick={() => conciliar(t.id)} disabled={conciliando === t.id}>
                        {conciliando === t.id ? "Conciliando…" : "Conciliar"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
