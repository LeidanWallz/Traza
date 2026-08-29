import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { encolarCaptura } from "../offlineQueue";
import type { PadronCliente, PadronProducto, PadronUbicacion, PadronUnidad } from "../types";

/**
 * Captura de origen: documento (vale/remisión/etc., §5-6) o formulario nativo
 * cuando no hay papel — mismo endpoint, mismo estatus de "primera clase"
 * (§6, §11). El tipo lo elige el usuario, no un flujo aparte.
 */
export default function CapturaOrigen() {
  const [unidades, setUnidades] = useState<PadronUnidad[]>([]);
  const [productos, setProductos] = useState<PadronProducto[]>([]);
  const [ubicaciones, setUbicaciones] = useState<PadronUbicacion[]>([]);
  const [clientes, setClientes] = useState<PadronCliente[]>([]);
  const [tipoEvidencia, setTipoEvidencia] = useState<"ORIGEN_DOCUMENTO" | "ORIGEN_CAPTURA_NATIVA">("ORIGEN_DOCUMENTO");
  const [msg, setMsg] = useState<{ tipo: "ok" | "err" | "info"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.padron.unidades().then(setUnidades).catch(() => {});
    api.padron.productos().then(setProductos).catch(() => {});
    api.padron.ubicaciones().then(setUbicaciones).catch(() => {});
    api.padron.clientes().then(setClientes).catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setMsg(null);

    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const foto = form.get("foto") as File;
    form.delete("foto");
    const fields: Record<string, string> = {};
    form.forEach((v, k) => (fields[k] = String(v)));

    try {
      if (!navigator.onLine) {
        await encolarCaptura("origen", fields, foto);
        setMsg({ tipo: "info", texto: "Sin señal: la captura quedó guardada en el dispositivo y se enviará sola al reconectar." });
      } else {
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
        fd.set("foto", foto);
        const trip = await api.trips.crear(fd);
        setMsg({ tipo: trip.estado === "EXCEPCION" ? "info" : "ok", texto: `Viaje registrado (${trip.estado}).` });
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
      <h1>Captura de origen</h1>
      <p className="subtitle">Documento de carga (vale, remisión…) o captura nativa si no hay papel.</p>

      <form className="panel" onSubmit={onSubmit}>
        <div className="field">
          <label>Tipo de captura</label>
          <select value={tipoEvidencia} onChange={(e) => setTipoEvidencia(e.target.value as never)}>
            <option value="ORIGEN_DOCUMENTO">Documento (vale/remisión/albarán)</option>
            <option value="ORIGEN_CAPTURA_NATIVA">Captura nativa (sin papel)</option>
          </select>
        </div>
        <input type="hidden" name="tipoEvidencia" value={tipoEvidencia} />

        {tipoEvidencia === "ORIGEN_DOCUMENTO" && (
          <div className="field">
            <label>Folio del documento</label>
            <input name="folioOrigen" placeholder="V-0001" />
          </div>
        )}

        <div className="field-row">
          <div className="field">
            <label>Unidad</label>
            <select name="unidadId" required>
              <option value="">Selecciona…</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>{u.identificador}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Producto</label>
            <select name="productoId" required>
              <option value="">Selecciona…</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Origen</label>
            <select name="origenId" required>
              <option value="">Selecciona…</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Destino</label>
            <select name="destinoId" required>
              <option value="">Selecciona…</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Cliente (opcional)</label>
          <select name="clienteId">
            <option value="">—</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Bruto (kg)</label>
            <input name="bruto" type="number" step="1" />
          </div>
          <div className="field">
            <label>Tara (kg)</label>
            <input name="tara" type="number" step="1" />
          </div>
        </div>
        <div className="field">
          <label>Neto (kg)</label>
          <input name="neto" type="number" step="1" />
        </div>

        <div className="field">
          <label>Foto (documento o respaldo de la unidad)</label>
          <input name="foto" type="file" accept="image/*" capture="environment" required />
        </div>

        {msg && <div className={`form-msg ${msg.tipo}`}>{msg.texto}</div>}

        <button type="submit" disabled={enviando}>
          {enviando ? "Enviando…" : "Registrar viaje"}
        </button>
      </form>
    </>
  );
}
