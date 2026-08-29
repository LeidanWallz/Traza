import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { guardarEvidencia } from "../evidenceStorage.js";
import { emitTurno } from "../socket.js";
import { esCantidadImposible, esDuplicado, evaluarEntrega } from "../domain/rulesEngine.js";
import { conciliar as conciliarDominio } from "../domain/tripStateMachine.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

export const tripsRouter = Router();

function extensionDe(mimetype: string): string {
  if (mimetype === "image/png") return "png";
  if (mimetype === "image/webp") return "webp";
  return "jpg";
}

/**
 * POST /trips — captura de origen. Acepta documento (ORIGEN_DOCUMENTO) o
 * formulario nativo cuando no hay papel (ORIGEN_CAPTURA_NATIVA) — ambos son
 * de primera clase, no un caso especial (§6, §11).
 *
 * El OCR (fuera del alcance de este endpoint) llenaría folioOrigen/bruto/
 * tara/neto a partir del documento; aquí se reciben ya extraídos porque la
 * capa de extracción es un servicio aparte del motor de reglas (§11).
 */
tripsRouter.post("/", upload.single("foto"), async (req, res) => {
  const tenantId = req.tenantId;
  const {
    tipoEvidencia,
    folioOrigen,
    unidadId,
    productoId,
    origenId,
    destinoId,
    clienteId,
    bruto,
    tara,
    neto,
  } = req.body as Record<string, string | undefined>;

  if (!tipoEvidencia || !["ORIGEN_DOCUMENTO", "ORIGEN_CAPTURA_NATIVA"].includes(tipoEvidencia)) {
    return res.status(400).json({ error: "tipoEvidencia debe ser ORIGEN_DOCUMENTO o ORIGEN_CAPTURA_NATIVA" });
  }
  if (!unidadId || !productoId || !origenId || !destinoId) {
    return res.status(400).json({ error: "unidadId, productoId, origenId y destinoId son obligatorios" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Falta la foto (documento o respaldo de captura nativa)" });
  }

  const unidad = await prisma.padronUnidad.findFirst({ where: { id: unidadId, tenantId } });
  if (!unidad) return res.status(404).json({ error: "Unidad no encontrada en el padrón de este tenant" });

  const netoNum = neto ? Number(neto) : null;

  const cantidadImposible = esCantidadImposible(netoNum, unidad.capacidadKg ?? null);

  const evidencia = await guardarEvidencia(tenantId, req.file.buffer, extensionDe(req.file.mimetype));

  const existentes = await prisma.evidencia.findMany({
    where: { trip: { tenantId }, tipo: "ORIGEN_DOCUMENTO" },
    select: { hash: true, trip: { select: { folioOrigen: true } } },
  });
  const duplicado = esDuplicado(
    { folioOrigen: folioOrigen ?? null, hash: evidencia.hash },
    existentes.map((e) => ({ folioOrigen: e.trip.folioOrigen, hash: e.hash }))
  );

  const trip = await prisma.trip.create({
    data: {
      tenantId,
      folioOrigen: folioOrigen || null,
      unidadId,
      productoId,
      origenId,
      destinoId,
      clienteId: clienteId || null,
      bruto: bruto ? Number(bruto) : null,
      tara: tara ? Number(tara) : null,
      neto: netoNum,
      estado: duplicado || cantidadImposible ? "EXCEPCION" : "EN_TRANSITO",
      evidencias: {
        create: {
          tipo: tipoEvidencia as "ORIGEN_DOCUMENTO" | "ORIGEN_CAPTURA_NATIVA",
          url: evidencia.url,
          hash: evidencia.hash,
        },
      },
      ...((duplicado || cantidadImposible) && {
        excepciones: {
          create: {
            tipo: duplicado ? "DUPLICADO" : "CANTIDAD_IMPOSIBLE",
            detalle: duplicado
              ? "Folio o imagen ya registrados en otro viaje."
              : `Neto (${netoNum}) excede la capacidad de la unidad (${unidad.capacidadKg}).`,
          },
        },
      }),
    },
    include: { evidencias: true, excepciones: true },
  });

  emitTurno(tenantId, "trip:creado", trip);
  res.status(201).json(trip);
});

/** GET /trips — lista del turno, opcionalmente filtrada por estado. */
tripsRouter.get("/", async (req, res) => {
  const { estado } = req.query as { estado?: string };
  const trips = await prisma.trip.findMany({
    where: { tenantId: req.tenantId, ...(estado ? { estado: estado as never } : {}) },
    include: { unidad: true, producto: true, origen: true, destino: true, cliente: true, excepciones: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(trips);
});

tripsRouter.get("/:id", async (req, res) => {
  const trip = await prisma.trip.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
    include: { unidad: true, producto: true, origen: true, destino: true, cliente: true, evidencias: true, excepciones: true },
  });
  if (!trip) return res.status(404).json({ error: "Viaje no encontrado" });
  res.json(trip);
});

/**
 * POST /trips/:id/entrega — la foto tomada en destino ES el evento de
 * entrega (§5.1). Se valida automática (folio detectado por OCR coincide) o
 * manual (OPS/RECIBIDOR confirma) — §5.2. Sin GPS, excepción GPS_FALTANTE en
 * vez de ENTREGADO, sin excepción (§5.4).
 */
tripsRouter.post("/:id/entrega", upload.single("foto"), async (req, res) => {
  const tenantId = req.tenantId;
  const trip = await prisma.trip.findFirst({
    where: { id: req.params.id, tenantId },
    include: { destino: true },
  });
  if (!trip) return res.status(404).json({ error: "Viaje no encontrado" });
  if (trip.estado !== "EN_TRANSITO") {
    return res.status(409).json({ error: `El viaje está en estado ${trip.estado}, no se puede procesar entrega` });
  }
  if (!req.file) return res.status(400).json({ error: "Falta la foto de entrega" });

  const { lat, lng, folioDetectado, confirmacionManual } = req.body as Record<string, string | undefined>;
  const gps = lat && lng ? { lat: Number(lat), lng: Number(lng) } : null;

  const resultado = evaluarEntrega({
    gps,
    destino: {
      lat: trip.destino.lat,
      lng: trip.destino.lng,
      radioValidacionM: trip.destino.radioValidacionM,
    },
    folioCoincide: Boolean(folioDetectado && trip.folioOrigen && folioDetectado === trip.folioOrigen),
    confirmacionManual: confirmacionManual === "true",
  });

  const evidencia = await guardarEvidencia(tenantId, req.file.buffer, extensionDe(req.file.mimetype));

  const actualizado = await prisma.$transaction(async (tx) => {
    await tx.evidencia.create({
      data: {
        tripId: trip.id,
        tipo: "ENTREGA_FOTO",
        url: evidencia.url,
        hash: evidencia.hash,
        gps: gps ?? undefined,
      },
    });

    if (resultado.ok) {
      return tx.trip.update({
        where: { id: trip.id },
        data: { estado: "ENTREGADO", validacionEntrega: resultado.validacion, horaEntrega: new Date() },
        include: { evidencias: true, excepciones: true },
      });
    }

    return tx.trip.update({
      where: { id: trip.id },
      data: {
        estado: "EXCEPCION",
        excepciones: { create: { tipo: resultado.excepcion, detalle: resultado.detalle } },
      },
      include: { evidencias: true, excepciones: true },
    });
  });

  emitTurno(tenantId, "trip:actualizado", actualizado);
  res.json(actualizado);
});

/** POST /trips/:id/conciliar — no procede si hay excepciones abiertas. */
tripsRouter.post("/:id/conciliar", async (req, res) => {
  const tenantId = req.tenantId;
  const trip = await prisma.trip.findFirst({
    where: { id: req.params.id, tenantId },
    include: { excepciones: true },
  });
  if (!trip) return res.status(404).json({ error: "Viaje no encontrado" });

  const excepcionAbierta = trip.excepciones.find((e) => e.estado === "ABIERTA");
  if (excepcionAbierta) {
    return res.status(409).json({ error: "El viaje tiene una excepción abierta, no se puede conciliar" });
  }

  try {
    conciliarDominio({ estado: trip.estado });
  } catch (err) {
    return res.status(409).json({ error: (err as Error).message });
  }

  const actualizado = await prisma.trip.update({
    where: { id: trip.id },
    data: { estado: "CONCILIADO" },
    include: { evidencias: true, excepciones: true },
  });

  emitTurno(tenantId, "trip:actualizado", actualizado);
  res.json(actualizado);
});
