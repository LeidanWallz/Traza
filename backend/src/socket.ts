import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

let io: Server | undefined;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    const tenantId = socket.handshake.auth?.tenantId as string | undefined;
    if (tenantId) {
      socket.join(`tenant:${tenantId}`);
    }
  });

  return io;
}

/** Emite un evento de turno en vivo a todos los clientes de ese tenant. */
export function emitTurno(tenantId: string, evento: string, payload: unknown) {
  io?.to(`tenant:${tenantId}`).emit(evento, payload);
}
