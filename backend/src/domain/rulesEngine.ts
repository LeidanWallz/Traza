// Motor de reglas — concilia, no extrae. El OCR (capa aparte, fuera de este
// archivo) solo produce campos + confianza; estas funciones deciden si el
// viaje avanza o cae en excepción. No inventar cantidad si no hay documento
// ni segunda medición (§5, §11).

import type { TipoExcepcion } from "./tripStateMachine";

export interface Coordenada {
  lat: number;
  lng: number;
}

export interface UbicacionDestino extends Coordenada {
  radioValidacionM: number;
}

/** Distancia en metros entre dos coordenadas (fórmula de Haversine). */
export function distanciaMetros(a: Coordenada, b: Coordenada): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

/** §5.4: sin coordenadas en la foto de entrega, no hay match posible. */
export function esGpsFaltante(gps: Coordenada | null | undefined): boolean {
  return gps == null || Number.isNaN(gps.lat) || Number.isNaN(gps.lng);
}

/**
 * §5.4: la foto de entrega debe haberse tomado dentro del radio de
 * tolerancia configurado para esa ubicación (default 300m, por ubicación).
 */
export function esDestinoNoCoincide(gpsFoto: Coordenada, destino: UbicacionDestino): boolean {
  return distanciaMetros(gpsFoto, destino) > destino.radioValidacionM;
}

/** Duplicado: mismo folio de origen o mismo hash de imagen ya visto. */
export function esDuplicado(
  candidato: { folioOrigen?: string | null; hash: string },
  existentes: Array<{ folioOrigen?: string | null; hash: string }>
): boolean {
  return existentes.some(
    (e) =>
      e.hash === candidato.hash ||
      (candidato.folioOrigen != null &&
        e.folioOrigen != null &&
        e.folioOrigen === candidato.folioOrigen)
  );
}

/** Cantidad imposible: el neto reportado excede la capacidad de la unidad. */
export function esCantidadImposible(neto: number | null | undefined, capacidadKg: number | null | undefined): boolean {
  if (neto == null || capacidadKg == null) return false;
  return neto > capacidadKg;
}

/** Timeout: pasó la ventana esperada sin foto de destino. */
export function esTimeoutSinEntrega(horaOrigen: Date, ahora: Date, ventanaMinutos: number): boolean {
  const minutosTranscurridos = (ahora.getTime() - horaOrigen.getTime()) / 60000;
  return minutosTranscurridos > ventanaMinutos;
}

export type ResultadoEvaluacionEntrega =
  | { ok: true; validacion: "AUTOMATICA" | "MANUAL" }
  | { ok: false; excepcion: TipoExcepcion; detalle: string };

/**
 * Orquesta las reglas de cierre de entrega (§5.2/§5.4), en orden de
 * severidad: GPS faltante antes que destino, porque sin coordenadas no hay
 * nada que comparar. Un `confirmacionManual=true` es la validación manual
 * de OPS/RECIBIDOR cuando no hubo match automático de folio.
 */
export function evaluarEntrega(input: {
  gps: Coordenada | null | undefined;
  destino: UbicacionDestino;
  folioCoincide: boolean; // resultado del OCR sobre la foto de entrega vs. folio de origen
  confirmacionManual?: boolean;
}): ResultadoEvaluacionEntrega {
  if (esGpsFaltante(input.gps)) {
    return { ok: false, excepcion: "GPS_FALTANTE", detalle: "La foto de entrega no trae coordenadas GPS." };
  }

  if (esDestinoNoCoincide(input.gps as Coordenada, input.destino)) {
    if (input.confirmacionManual) {
      return { ok: true, validacion: "MANUAL" };
    }
    return {
      ok: false,
      excepcion: "DESTINO_NO_COINCIDE",
      detalle: "El GPS de la foto está fuera del radio de tolerancia del destino.",
    };
  }

  if (input.folioCoincide) {
    return { ok: true, validacion: "AUTOMATICA" };
  }

  if (input.confirmacionManual) {
    return { ok: true, validacion: "MANUAL" };
  }

  return {
    ok: false,
    excepcion: "DESTINO_NO_COINCIDE",
    detalle: "El folio de la foto de entrega no coincide con el vale de origen y no hay confirmación manual.",
  };
}
