import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { encolarCaptura } from "../offlineQueue";
import type { Trip } from "../types";

/**
 * Cierre de entrega: la foto tomada en destino ES el evento de entrega
 * (§5.1). El GPS es obligatorio — si el navegador no lo entrega, se envía
 * igual y el backend decide GPS_FALTANTE (§5.4); nunca se bloquea la
 * captura localmente, la regla vive en el servidor.
 */
export default function CerrarEntrega() {
  const [enTransito, setEnTransito] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState("");
  const [gps, setGps] = useState<GeolocationCoordinates | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "err" | "info"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.trips.list("EN_TRANSITO").then(setEnTransito).catch(() => {});
  }, [msg]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("Este dispositivo no soporta geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps(pos.coords),
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tripId) return;
    setEnviando(true);
    setMsg(null);

    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const foto = form.get("foto") as File;
    form.delete("foto");
    if (gps) {
      form.set("lat", String(gps.latitude));
      form.set("lng", String(gps.longitude));
    }
    const fields: Record<string, string> = {};
    form.forEach((v, k) => (fields[k] = String(v)));

    try {
      if (!navigator.onLine) {
        await encolarCaptura("entrega", fields, foto, tripId);
        setMsg({ tipo: "info", texto: "Sin señal: la entrega quedó guardada en el dispositivo y se enviará sola al reconectar." });
      } else {
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
        fd.set("foto", foto);
        const trip = await api.trips.entrega(tripId, fd);
        setMsg({
          tipo: trip.estado === "EXCEPCION" ? "info" : "ok",
          texto: trip.estado === "EXCEPCION" ? `Cayó en excepción: revisa la bandeja.` : "Entrega registrada.",
        });
      }
      formEl.reset();
    } catch (err) {
      setMsg({ tipo: "err", texto: (err as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <h1>Cerrar entrega</h1>
      <p className="subtitle">Foto tomada en destino + GPS del dispositivo — es el evento de entrega.</p>

      <form className="panel" onSubmit={onSubmit}>
        <div className="field">
          <label>Viaje en tránsito</label>
          <select value={tripId} onChange={(e) => setTripId(e.target.value)} required>
            <option value="">Selecciona…</option>
            {enTransito.map((t) => (
              <option key={t.id} value={t.id}>
                {t.folioOrigen ?? "(sin folio)"} · {t.unidad.identificador} · {t.destino.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Folio detectado en la foto (si el sello es legible)</label>
          <input name="folioDetectado" placeholder="Debe coincidir con el folio de origen para validar automático" />
        </div>

        <div className="field">
          <label>Foto de entrega</label>
          <input name="foto" type="file" accept="image/*" capture="environment" required />
        </div>

        <div className="gps-status">
          {gps
            ? `GPS: ${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)} (±${Math.round(gps.accuracy)}m)`
            : gpsError
              ? `Sin GPS: ${gpsError} — la entrega puede caer en excepción GPS_FALTANTE.`
              : "Obteniendo GPS…"}
        </div>

        <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" name="confirmacionManual" value="true" style={{ width: "auto" }} />
          <span>Confirmo la entrega manualmente (OPS/RECIBIDOR) aunque no coincida el folio automático</span>
        </label>

        {msg && <div className={`form-msg ${msg.tipo}`}>{msg.texto}</div>}

        <button type="submit" disabled={enviando || !tripId}>
          {enviando ? "Enviando…" : "Cerrar entrega"}
        </button>
      </form>
    </>
  );
}
