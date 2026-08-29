import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useTurnoEnVivo } from "../useTurnoEnVivo";
import type { Excepcion } from "../types";

const ETIQUETAS: Record<string, string> = {
  DUPLICADO: "Duplicado",
  CANTIDAD_IMPOSIBLE: "Cantidad imposible",
  TIMEOUT_SIN_ENTREGA: "Timeout sin entrega",
  GPS_FALTANTE: "GPS faltante",
  DESTINO_NO_COINCIDE: "Destino no coincide",
};

export default function Excepciones() {
  const [excepciones, setExcepciones] = useState<Excepcion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api.excepciones
      .list("ABIERTA")
      .then(setExcepciones)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(cargar, [cargar]);
  useTurnoEnVivo(cargar);

  async function liberar(id: string, estadoPrevio: "EN_TRANSITO" | "ENTREGADO") {
    setProcesando(id);
    try {
      await api.excepciones.liberar(id, estadoPrevio);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcesando(null);
    }
  }

  async function rechazar(id: string) {
    setProcesando(id);
    try {
      await api.excepciones.rechazar(id);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcesando(null);
    }
  }

  return (
    <>
      <h1>Bandeja de excepciones</h1>
      <p className="subtitle">Viajes que no pasaron las reglas automáticas — libera o rechaza.</p>
      {error && <div className="form-msg err" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="excepciones-list">
        {excepciones.length === 0 && <div className="empty">No hay excepciones abiertas.</div>}
        {excepciones.map((e) => (
          <div className="excepcion-card" key={e.id}>
            <div>
              <div className="excepcion-tipo">{ETIQUETAS[e.tipo] ?? e.tipo}</div>
              <div className="excepcion-detalle">
                {e.trip?.folioOrigen ?? "(sin folio)"} · {e.trip?.producto?.nombre} · {e.trip?.unidad?.identificador}
              </div>
              <div className="excepcion-detalle">{e.detalle}</div>
            </div>
            <div className="excepcion-actions">
              <button
                className="secondary"
                disabled={procesando === e.id}
                onClick={() => liberar(e.id, e.trip?.horaEntrega ? "ENTREGADO" : "EN_TRANSITO")}
                title="Regresa el viaje al estado previo a la excepción"
              >
                Liberar
              </button>
              <button className="danger" disabled={procesando === e.id} onClick={() => rechazar(e.id)}>
                Rechazar
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
