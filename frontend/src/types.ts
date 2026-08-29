export type EstadoViaje = "EN_TRANSITO" | "ENTREGADO" | "CONCILIADO" | "EXCEPCION";
export type TipoExcepcion =
  | "DUPLICADO"
  | "CANTIDAD_IMPOSIBLE"
  | "TIMEOUT_SIN_ENTREGA"
  | "GPS_FALTANTE"
  | "DESTINO_NO_COINCIDE";
export type EstadoExcepcion = "ABIERTA" | "LIBERADA" | "RECHAZADA";

export interface PadronUnidad {
  id: string;
  identificador: string;
  capacidadKg: number | null;
}
export interface PadronProducto {
  id: string;
  nombre: string;
  unidadMedida: string;
}
export interface PadronUbicacion {
  id: string;
  nombre: string;
  tipo: string;
  lat: number;
  lng: number;
  radioValidacionM: number;
}
export interface PadronCliente {
  id: string;
  nombre: string;
}

export interface Excepcion {
  id: string;
  tipo: TipoExcepcion;
  detalle: string;
  estado: EstadoExcepcion;
  createdAt: string;
  trip?: Trip;
}

export interface Trip {
  id: string;
  folioOrigen: string | null;
  estado: EstadoViaje;
  bruto: number | null;
  tara: number | null;
  neto: number | null;
  horaOrigen: string;
  horaEntrega: string | null;
  validacionEntrega: "AUTOMATICA" | "MANUAL" | null;
  unidad: PadronUnidad;
  producto: PadronProducto;
  origen: PadronUbicacion;
  destino: PadronUbicacion;
  cliente: PadronCliente | null;
  excepciones: Excepcion[];
}
