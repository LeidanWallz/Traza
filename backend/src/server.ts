import path from "node:path";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { prisma } from "./prisma.js";
import { tenantMiddleware } from "./middleware/tenant.js";
import { tripsRouter } from "./routes/trips.js";
import { excepcionesRouter } from "./routes/excepciones.js";
import { padronRouter } from "./routes/padron.js";
import { initSocket, emitTurno } from "./socket.js";
import { esTimeoutSinEntrega } from "./domain/rulesEngine.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/trips", tenantMiddleware, tripsRouter);
app.use("/excepciones", tenantMiddleware, excepcionesRouter);
app.use("/padron", tenantMiddleware, padronRouter);

const httpServer = createServer(app);
initSocket(httpServer);

// Job de timeout: revisa viajes EN_TRANSITO que rebasaron la ventana
// esperada sin foto de destino (§5, regla "Timeout sin entrega"). El brief
// no fija la ventana por tenant/ubicación todavía, así que se usa un default
// global configurable por env mientras se define ese criterio de negocio.
const VENTANA_TIMEOUT_MINUTOS = Number(process.env.VENTANA_TIMEOUT_MINUTOS ?? 240);

async function revisarTimeouts() {
  const enTransito = await prisma.trip.findMany({ where: { estado: "EN_TRANSITO" } });
  const ahora = new Date();
  for (const trip of enTransito) {
    if (esTimeoutSinEntrega(trip.horaOrigen, ahora, VENTANA_TIMEOUT_MINUTOS)) {
      const actualizado = await prisma.trip.update({
        where: { id: trip.id },
        data: {
          estado: "EXCEPCION",
          excepciones: { create: { tipo: "TIMEOUT_SIN_ENTREGA", detalle: "Pasó la ventana esperada sin foto de destino." } },
        },
        include: { evidencias: true, excepciones: true },
      });
      emitTurno(trip.tenantId, "trip:actualizado", actualizado);
    }
  }
}
setInterval(() => void revisarTimeouts(), 5 * 60 * 1000);

const PORT = Number(process.env.PORT ?? 4000);
httpServer.listen(PORT, () => {
  console.log(`Traza backend escuchando en http://localhost:${PORT}`);
});
