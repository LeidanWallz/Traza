import { Router } from "express";
import { prisma } from "../prisma.js";

// Solo lectura para el MVP — el contenido del padrón lo decide cada cliente
// (§8); un CRUD completo de administración queda fuera del alcance del día 1.
export const padronRouter = Router();

padronRouter.get("/unidades", async (req, res) => {
  res.json(await prisma.padronUnidad.findMany({ where: { tenantId: req.tenantId } }));
});

padronRouter.get("/productos", async (req, res) => {
  res.json(await prisma.padronProducto.findMany({ where: { tenantId: req.tenantId } }));
});

padronRouter.get("/ubicaciones", async (req, res) => {
  res.json(await prisma.padronUbicacion.findMany({ where: { tenantId: req.tenantId } }));
});

padronRouter.get("/clientes", async (req, res) => {
  res.json(await prisma.padronCliente.findMany({ where: { tenantId: req.tenantId } }));
});
