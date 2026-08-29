// Máquina de estados del Viaje — dominio puro, sin dependencia de base de datos.
// EN_TRANSITO → ENTREGADO → CONCILIADO, con rama a EXCEPCION en cualquier punto.
// Ver TRAZA_BRIEF_CLAUDE_CODE.md §5: estas reglas son literales, no se simplifican.

export type EstadoViaje = "EN_TRANSITO" | "ENTREGADO" | "CONCILIADO" | "EXCEPCION";

export type ValidacionEntrega = "AUTOMATICA" | "MANUAL";

export type TipoExcepcion =
  | "DUPLICADO"
  | "CANTIDAD_IMPOSIBLE"
  | "TIMEOUT_SIN_ENTREGA"
  | "GPS_FALTANTE"
  | "DESTINO_NO_COINCIDE";

export interface TripState {
  estado: EstadoViaje;
  validacionEntrega?: ValidacionEntrega;
  excepcionAbierta?: TipoExcepcion;
}

export class TransicionInvalidaError extends Error {
  constructor(desde: EstadoViaje, evento: string) {
    super(`Transición inválida: no se puede aplicar "${evento}" desde el estado "${desde}"`);
    this.name = "TransicionInvalidaError";
  }
}

/**
 * Marca el viaje como entregado: la foto de destino ES el evento de entrega (§5.1).
 * Requiere que ya haya pasado la validación de GPS/destino/duplicado/cantidad
 * (eso lo decide el motor de reglas, no esta función) — aquí solo se registra
 * cómo se validó: automática o manual (§5.2).
 */
export function marcarEntregado(
  estado: TripState,
  validacion: ValidacionEntrega
): TripState {
  if (estado.estado !== "EN_TRANSITO") {
    throw new TransicionInvalidaError(estado.estado, "marcarEntregado");
  }
  return { estado: "ENTREGADO", validacionEntrega: validacion };
}

/**
 * Abre una excepción sobre el viaje. Puede ocurrir desde EN_TRANSITO (p. ej.
 * timeout) o al intentar procesar la entrega (p. ej. GPS_FALTANTE, que impide
 * avanzar a ENTREGADO — §5.4).
 */
export function abrirExcepcion(estado: TripState, tipo: TipoExcepcion): TripState {
  if (estado.estado === "CONCILIADO") {
    throw new TransicionInvalidaError(estado.estado, "abrirExcepcion");
  }
  return { ...estado, estado: "EXCEPCION", excepcionAbierta: tipo };
}

/**
 * Libera una excepción: el viaje vuelve al estado que tenía antes de caer en
 * excepción. `estadoPrevio` lo decide quien orquesta (normalmente EN_TRANSITO
 * o ENTREGADO), esta función solo valida la transición.
 */
export function liberarExcepcion(
  estado: TripState,
  estadoPrevio: Exclude<EstadoViaje, "EXCEPCION" | "CONCILIADO">
): TripState {
  if (estado.estado !== "EXCEPCION") {
    throw new TransicionInvalidaError(estado.estado, "liberarExcepcion");
  }
  return { estado: estadoPrevio, excepcionAbierta: undefined };
}

/**
 * Rechaza una excepción: el viaje permanece en EXCEPCION (rechazo no es
 * "cerrar", es un dictamen humano de que el viaje no procede — no forma
 * parte de esta versión de la máquina de estados el borrado del viaje).
 */
export function rechazarExcepcion(estado: TripState): TripState {
  if (estado.estado !== "EXCEPCION") {
    throw new TransicionInvalidaError(estado.estado, "rechazarExcepcion");
  }
  return { ...estado };
}

/**
 * Concilia el viaje: solo procede si está ENTREGADO y no hay excepción
 * abierta. El destino siempre fue obligatorio para llegar a ENTREGADO,
 * así que aquí no se vuelve a validar destino (§5.3 ya se cumplió antes).
 */
export function conciliar(estado: TripState): TripState {
  if (estado.estado !== "ENTREGADO") {
    throw new TransicionInvalidaError(estado.estado, "conciliar");
  }
  return { ...estado, estado: "CONCILIADO" };
}
