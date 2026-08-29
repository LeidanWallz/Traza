import type { NextFunction, Request, Response } from "express";
import { prisma } from "../prisma.js";

// MVP: el brief no define todavía el flujo de autenticación real, solo los
// roles (§4). Mientras tanto, el tenant y el usuario se resuelven por header
// — esto es lo primero que hay que sustituir por auth real, no un patrón a
// mantener. Lo que sí es definitivo: todo query pasa por aquí (§11).

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId: string;
      userId?: string;
    }
  }
}

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.header("x-tenant-id");
  if (!tenantId) {
    return res.status(401).json({ error: "Falta header x-tenant-id" });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return res.status(401).json({ error: "Tenant no encontrado" });
  }

  req.tenantId = tenantId;
  req.userId = req.header("x-user-id") ?? undefined;
  next();
}
