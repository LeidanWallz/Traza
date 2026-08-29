import { describe, it, expect } from "vitest";
import {
  distanciaMetros,
  esGpsFaltante,
  esDestinoNoCoincide,
  esDuplicado,
  esCantidadImposible,
  esTimeoutSinEntrega,
  evaluarEntrega,
} from "./rulesEngine";

describe("rulesEngine", () => {
  it("distanciaMetros es ~0 para el mismo punto", () => {
    const p = { lat: 19.4326, lng: -99.1332 };
    expect(distanciaMetros(p, p)).toBeCloseTo(0, 3);
  });

  it("esGpsFaltante detecta null/undefined/NaN", () => {
    expect(esGpsFaltante(null)).toBe(true);
    expect(esGpsFaltante(undefined)).toBe(true);
    expect(esGpsFaltante({ lat: NaN, lng: -99 })).toBe(true);
    expect(esGpsFaltante({ lat: 19.4, lng: -99.1 })).toBe(false);
  });

  it("esDestinoNoCoincide respeta el radio configurable por ubicación", () => {
    const destino = { lat: 19.4326, lng: -99.1332, radioValidacionM: 300 };
    const cerca = { lat: 19.4327, lng: -99.1332 }; // ~11m
    const lejos = { lat: 19.45, lng: -99.15 }; // varios km
    expect(esDestinoNoCoincide(cerca, destino)).toBe(false);
    expect(esDestinoNoCoincide(lejos, destino)).toBe(true);
  });

  it("esDuplicado por hash", () => {
    const existentes = [{ folioOrigen: "A1", hash: "h1" }];
    expect(esDuplicado({ folioOrigen: "B2", hash: "h1" }, existentes)).toBe(true);
  });

  it("esDuplicado por folio", () => {
    const existentes = [{ folioOrigen: "A1", hash: "h1" }];
    expect(esDuplicado({ folioOrigen: "A1", hash: "h2" }, existentes)).toBe(true);
  });

  it("no es duplicado si folio y hash son distintos", () => {
    const existentes = [{ folioOrigen: "A1", hash: "h1" }];
    expect(esDuplicado({ folioOrigen: "B2", hash: "h2" }, existentes)).toBe(false);
  });

  it("esCantidadImposible cuando el neto excede la capacidad de la unidad", () => {
    expect(esCantidadImposible(35000, 30000)).toBe(true);
    expect(esCantidadImposible(20000, 30000)).toBe(false);
  });

  it("esCantidadImposible es false si falta neto o capacidad (no inventa)", () => {
    expect(esCantidadImposible(null, 30000)).toBe(false);
    expect(esCantidadImposible(20000, null)).toBe(false);
  });

  it("esTimeoutSinEntrega detecta ventana vencida", () => {
    const origen = new Date("2026-08-29T08:00:00Z");
    const ahora = new Date("2026-08-29T12:00:00Z");
    expect(esTimeoutSinEntrega(origen, ahora, 180)).toBe(true);
    expect(esTimeoutSinEntrega(origen, ahora, 300)).toBe(false);
  });

  describe("evaluarEntrega", () => {
    const destino = { lat: 19.4326, lng: -99.1332, radioValidacionM: 300 };

    it("sin GPS -> excepción GPS_FALTANTE, nunca ENTREGADO", () => {
      const r = evaluarEntrega({ gps: null, destino, folioCoincide: true });
      expect(r).toMatchObject({ ok: false, excepcion: "GPS_FALTANTE" });
    });

    it("GPS fuera de radio sin confirmación manual -> DESTINO_NO_COINCIDE", () => {
      const r = evaluarEntrega({
        gps: { lat: 19.45, lng: -99.15 },
        destino,
        folioCoincide: true,
      });
      expect(r).toMatchObject({ ok: false, excepcion: "DESTINO_NO_COINCIDE" });
    });

    it("GPS fuera de radio con confirmación manual -> ENTREGADO validación MANUAL", () => {
      const r = evaluarEntrega({
        gps: { lat: 19.45, lng: -99.15 },
        destino,
        folioCoincide: false,
        confirmacionManual: true,
      });
      expect(r).toEqual({ ok: true, validacion: "MANUAL" });
    });

    it("GPS dentro de radio y folio coincide -> ENTREGADO validación AUTOMATICA", () => {
      const r = evaluarEntrega({
        gps: { lat: 19.4327, lng: -99.1332 },
        destino,
        folioCoincide: true,
      });
      expect(r).toEqual({ ok: true, validacion: "AUTOMATICA" });
    });

    it("GPS dentro de radio pero folio no coincide, sin confirmación -> excepción", () => {
      const r = evaluarEntrega({
        gps: { lat: 19.4327, lng: -99.1332 },
        destino,
        folioCoincide: false,
      });
      expect(r).toMatchObject({ ok: false, excepcion: "DESTINO_NO_COINCIDE" });
    });

    it("GPS dentro de radio, folio no coincide, pero hay confirmación manual -> ENTREGADO MANUAL", () => {
      const r = evaluarEntrega({
        gps: { lat: 19.4327, lng: -99.1332 },
        destino,
        folioCoincide: false,
        confirmacionManual: true,
      });
      expect(r).toEqual({ ok: true, validacion: "MANUAL" });
    });
  });
});
