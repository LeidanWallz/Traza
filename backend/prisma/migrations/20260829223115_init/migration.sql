-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'OPS', 'CHOFER', 'RECIBIDOR');

-- CreateEnum
CREATE TYPE "EstadoViaje" AS ENUM ('EN_TRANSITO', 'ENTREGADO', 'CONCILIADO', 'EXCEPCION');

-- CreateEnum
CREATE TYPE "ValidacionEntrega" AS ENUM ('AUTOMATICA', 'MANUAL');

-- CreateEnum
CREATE TYPE "TipoEvidencia" AS ENUM ('ORIGEN_DOCUMENTO', 'ORIGEN_CAPTURA_NATIVA', 'ENTREGA_FOTO');

-- CreateEnum
CREATE TYPE "TipoExcepcion" AS ENUM ('DUPLICADO', 'CANTIDAD_IMPOSIBLE', 'TIMEOUT_SIN_ENTREGA', 'GPS_FALTANTE', 'DESTINO_NO_COINCIDE');

-- CreateEnum
CREATE TYPE "EstadoExcepcion" AS ENUM ('ABIERTA', 'LIBERADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PadronUnidad" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "capacidadKg" DOUBLE PRECISION,

    CONSTRAINT "PadronUnidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PadronProducto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL,

    CONSTRAINT "PadronProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PadronUbicacion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radioValidacionM" INTEGER NOT NULL DEFAULT 300,

    CONSTRAINT "PadronUbicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PadronCliente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "PadronCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "folioOrigen" TEXT,
    "unidadId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "bruto" DOUBLE PRECISION,
    "tara" DOUBLE PRECISION,
    "neto" DOUBLE PRECISION,
    "origenId" TEXT NOT NULL,
    "destinoId" TEXT NOT NULL,
    "clienteId" TEXT,
    "estado" "EstadoViaje" NOT NULL DEFAULT 'EN_TRANSITO',
    "horaOrigen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horaEntrega" TIMESTAMP(3),
    "validacionEntrega" "ValidacionEntrega",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidencia" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "tipo" "TipoEvidencia" NOT NULL,
    "url" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "gps" JSONB,
    "horaDispositivo" TIMESTAMP(3),
    "ocrCrudo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Excepcion" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "tipo" "TipoExcepcion" NOT NULL,
    "detalle" TEXT NOT NULL,
    "estado" "EstadoExcepcion" NOT NULL DEFAULT 'ABIERTA',
    "resueltaPorId" TEXT,
    "resueltaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Excepcion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "PadronUnidad_tenantId_idx" ON "PadronUnidad"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PadronUnidad_tenantId_identificador_key" ON "PadronUnidad"("tenantId", "identificador");

-- CreateIndex
CREATE INDEX "PadronProducto_tenantId_idx" ON "PadronProducto"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PadronProducto_tenantId_nombre_key" ON "PadronProducto"("tenantId", "nombre");

-- CreateIndex
CREATE INDEX "PadronUbicacion_tenantId_idx" ON "PadronUbicacion"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PadronUbicacion_tenantId_nombre_key" ON "PadronUbicacion"("tenantId", "nombre");

-- CreateIndex
CREATE INDEX "PadronCliente_tenantId_idx" ON "PadronCliente"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PadronCliente_tenantId_nombre_key" ON "PadronCliente"("tenantId", "nombre");

-- CreateIndex
CREATE INDEX "Trip_tenantId_estado_idx" ON "Trip"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "Trip_tenantId_folioOrigen_idx" ON "Trip"("tenantId", "folioOrigen");

-- CreateIndex
CREATE INDEX "Evidencia_tripId_idx" ON "Evidencia"("tripId");

-- CreateIndex
CREATE INDEX "Evidencia_hash_idx" ON "Evidencia"("hash");

-- CreateIndex
CREATE INDEX "Excepcion_tripId_idx" ON "Excepcion"("tripId");

-- CreateIndex
CREATE INDEX "Excepcion_tripId_estado_idx" ON "Excepcion"("tripId", "estado");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PadronUnidad" ADD CONSTRAINT "PadronUnidad_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PadronProducto" ADD CONSTRAINT "PadronProducto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PadronUbicacion" ADD CONSTRAINT "PadronUbicacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PadronCliente" ADD CONSTRAINT "PadronCliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "PadronUnidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "PadronProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "PadronUbicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "PadronUbicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "PadronCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excepcion" ADD CONSTRAINT "Excepcion_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excepcion" ADD CONSTRAINT "Excepcion_resueltaPorId_fkey" FOREIGN KEY ("resueltaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
