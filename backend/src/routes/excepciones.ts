import { Router } from "express";
import { prisma } from "../prisma.js";
import { emitTurno } from "../socket.js";
import { liberarExcepcion, rechazarExcepcion } from "../domain/tripStateMachine.js";
import type { EstadoViaje } from "../domain/tripStateMachine.js";

export const excepcionesRouter = Router();

/** GET /excepciones — bandeja de excepciones (default: solo abiertas). */
excepcionesRouter.get("/", async (req, res) => {
  const { estado } = req.query as { estado?: string };
  const excepciones = await prisma.excepcion.findMany({
    where: {
      trip: { tenantId: req.tenantId },
      estado: (estado as never) ?? "ABIERTA",
    },
    include: {
      trip: { include: { unidad: true, producto: true, origen: true, destino: true } },
      resueltaPor: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(excepciones);
});

/**
 * POST /excepciones/:id/liberar — un humano (OPS/RECIBIDOR) libera la
 * excepción; el viaje regresa al estado que tenía antes de caer en ella.
 * `estadoPrevio` lo decide quien libera, según a qué punto del flujo
 * corresponde reanudar (EN_TRANSITO si nunca llegó a entrega, ENTREGADO si
 * ya había foto de destino y solo faltaba resolver la excepción).
 */
excepcionesRouter.post("/:id/liberar", async (req, res) => {
  const { estadoPrevio } = req.body as { estadoPrevio?: EstadoViaje };
  if (estadoPrevio !== "EN_TRANSITO" && estadoPrevio !== "ENTREGADO") {
    return res.status(400).json({ error: "estadoPrevio debe ser EN_TRANSITO o ENTREGADO" });
  }

  const excepcion = await prisma.excepcion.findFirst({
    where: { id: req.params.id, trip: { tenantId: req.tenantId } },
    include: { trip: true },
  });
  if (!excepcion) return res.status(404).json({ error: "Excepción no encontrada" });
  if (excepcion.estado !== "ABIERTA") {
    return res.status(409).json({ error: "La excepción ya fue resuelta" });
  }

  try {
    liberarExcepcion({ estado: excepcion.trip.estado }, estadoPrevio);
  } catch (err) {
    return res.status(409).json({ error: (err as Error).message });
  }

  const [, trip] = await prisma.$transaction([
    prisma.excepcion.update({
      where: { id: excepcion.id },
      data: { estado: "LIBERADA", resueltaPorId: req.userId, resueltaAt: new Date() },
    }),
    prisma.trip.update({
      where: { id: excepcion.tripId },
      data: { estado: estadoPrevio },
      include: { evidencias: true, excepciones: true },
    }),
  ]);

  emitTurno(req.tenantId, "trip:actualizado", trip);
  res.json(trip);
});

/** POST /excepciones/:id/rechazar — el viaje permanece en EXCEPCION. */
excepcionesRouter.post("/:id/rechazar", async (req, res) => {
  const excepcion = await prisma.excepcion.findFirst({
    where: { id: req.params.id, trip: { tenantId: req.tenantId } },
    include: { trip: true },
  });
  if (!excepcion) return res.status(404).json({ error: "Excepción no encontrada" });
  if (excepcion.estado !== "ABIERTA") {
    return res.status(409).json({ error: "La excepción ya fue resuelta" });
  }

  rechazarExcepcion({ estado: excepcion.trip.estado });

  const actualizada = await prisma.excepcion.update({
    where: { id: excepcion.id },
    data: { estado: "RECHAZADA", resueltaPorId: req.userId, resueltaAt: new Date() },
    include: { trip: true },
  });

  emitTurno(req.tenantId, "trip:actualizado", actualizada.trip);
  res.json(actualizada);
});
