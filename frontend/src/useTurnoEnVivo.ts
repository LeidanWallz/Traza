import { useEffect } from "react";
import { io } from "socket.io-client";
import { BACKEND_ORIGIN } from "./config";
import { getTenantId } from "./tenant";

/** Suscribe al turno en vivo del tenant activo (§7 "Dashboard de turno en vivo"). */
export function useTurnoEnVivo(onCambio: () => void) {
  useEffect(() => {
    const socket = io(BACKEND_ORIGIN, {
      path: "/socket.io",
      auth: { tenantId: getTenantId() },
    });
    socket.on("trip:creado", onCambio);
    socket.on("trip:actualizado", onCambio);
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
