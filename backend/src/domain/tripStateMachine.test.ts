import { describe, it, expect } from "vitest";
import {
  marcarEntregado,
  abrirExcepcion,
  liberarExcepcion,
  rechazarExcepcion,
  conciliar,
  TransicionInvalidaError,
  type TripState,
} from "./tripStateMachine";

describe("tripStateMachine", () => {
  it("EN_TRANSITO -> ENTREGADO (validación automática)", () => {
    const estado: TripState = { estado: "EN_TRANSITO" };
    const siguiente = marcarEntregado(estado, "AUTOMATICA");
    expect(siguiente).toEqual({ estado: "ENTREGADO", validacionEntrega: "AUTOMATICA" });
  });

  it("EN_TRANSITO -> ENTREGADO (validación manual)", () => {
    const estado: TripState = { estado: "EN_TRANSITO" };
    const siguiente = marcarEntregado(estado, "MANUAL");
    expect(siguiente.validacionEntrega).toBe("MANUAL");
  });

  it("no permite marcarEntregado si no está EN_TRANSITO", () => {
    const estado: TripState = { estado: "ENTREGADO", validacionEntrega: "AUTOMATICA" };
    expect(() => marcarEntregado(estado, "MANUAL")).toThrow(TransicionInvalidaError);
  });

  it("EN_TRANSITO -> EXCEPCION (p.ej. timeout)", () => {
    const estado: TripState = { estado: "EN_TRANSITO" };
    const siguiente = abrirExcepcion(estado, "TIMEOUT_SIN_ENTREGA");
    expect(siguiente).toEqual({ estado: "EXCEPCION", excepcionAbierta: "TIMEOUT_SIN_ENTREGA" });
  });

  it("intento de entrega sin GPS abre EXCEPCION en vez de ENTREGADO (§5.4)", () => {
    const estado: TripState = { estado: "EN_TRANSITO" };
    const siguiente = abrirExcepcion(estado, "GPS_FALTANTE");
    expect(siguiente.estado).toBe("EXCEPCION");
    expect(siguiente.excepcionAbierta).toBe("GPS_FALTANTE");
  });

  it("no permite abrir excepción sobre un viaje CONCILIADO", () => {
    const estado: TripState = { estado: "CONCILIADO" };
    expect(() => abrirExcepcion(estado, "DUPLICADO")).toThrow(TransicionInvalidaError);
  });

  it("liberarExcepcion regresa al estado previo (EN_TRANSITO)", () => {
    const estado: TripState = { estado: "EXCEPCION", excepcionAbierta: "GPS_FALTANTE" };
    const siguiente = liberarExcepcion(estado, "EN_TRANSITO");
    expect(siguiente).toEqual({ estado: "EN_TRANSITO", excepcionAbierta: undefined });
  });

  it("liberarExcepcion regresa al estado previo (ENTREGADO)", () => {
    const estado: TripState = { estado: "EXCEPCION", excepcionAbierta: "DESTINO_NO_COINCIDE" };
    const siguiente = liberarExcepcion(estado, "ENTREGADO");
    expect(siguiente.estado).toBe("ENTREGADO");
  });

  it("no permite liberar excepción si no está en EXCEPCION", () => {
    const estado: TripState = { estado: "EN_TRANSITO" };
    expect(() => liberarExcepcion(estado, "EN_TRANSITO")).toThrow(TransicionInvalidaError);
  });

  it("rechazarExcepcion mantiene el viaje en EXCEPCION", () => {
    const estado: TripState = { estado: "EXCEPCION", excepcionAbierta: "CANTIDAD_IMPOSIBLE" };
    const siguiente = rechazarExcepcion(estado);
    expect(siguiente.estado).toBe("EXCEPCION");
  });

  it("conciliar solo procede desde ENTREGADO", () => {
    const estado: TripState = { estado: "ENTREGADO", validacionEntrega: "AUTOMATICA" };
    const siguiente = conciliar(estado);
    expect(siguiente.estado).toBe("CONCILIADO");
  });

  it("no permite conciliar un viaje EN_TRANSITO", () => {
    const estado: TripState = { estado: "EN_TRANSITO" };
    expect(() => conciliar(estado)).toThrow(TransicionInvalidaError);
  });

  it("no permite conciliar un viaje con EXCEPCION abierta", () => {
    const estado: TripState = { estado: "EXCEPCION", excepcionAbierta: "DUPLICADO" };
    expect(() => conciliar(estado)).toThrow(TransicionInvalidaError);
  });
});
