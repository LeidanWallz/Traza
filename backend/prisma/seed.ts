import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: "tenant-demo" },
    update: {},
    create: { id: "tenant-demo", nombre: "Agregados Demo S.A. de C.V." },
  });

  const admin = await prisma.user.upsert({
    where: { email: "ops@agregadosdemo.mx" },
    update: {},
    create: { tenantId: tenant.id, email: "ops@agregadosdemo.mx", nombre: "Turno OPS", rol: "OPS" },
  });

  const unidad1 = await prisma.padronUnidad.upsert({
    where: { tenantId_identificador: { tenantId: tenant.id, identificador: "T-101" } },
    update: {},
    create: { tenantId: tenant.id, identificador: "T-101", capacidadKg: 20000 },
  });
  const unidad2 = await prisma.padronUnidad.upsert({
    where: { tenantId_identificador: { tenantId: tenant.id, identificador: "T-102" } },
    update: {},
    create: { tenantId: tenant.id, identificador: "T-102", capacidadKg: 30000 },
  });

  const grava = await prisma.padronProducto.upsert({
    where: { tenantId_nombre: { tenantId: tenant.id, nombre: "Grava 3/4" } },
    update: {},
    create: { tenantId: tenant.id, nombre: "Grava 3/4", unidadMedida: "kg" },
  });
  const arena = await prisma.padronProducto.upsert({
    where: { tenantId_nombre: { tenantId: tenant.id, nombre: "Arena" } },
    update: {},
    create: { tenantId: tenant.id, nombre: "Arena", unidadMedida: "kg" },
  });

  const cantera = await prisma.padronUbicacion.upsert({
    where: { tenantId_nombre: { tenantId: tenant.id, nombre: "Cantera Norte" } },
    update: {},
    create: { tenantId: tenant.id, nombre: "Cantera Norte", tipo: "origen", lat: 19.4978, lng: -99.1269, radioValidacionM: 300 },
  });
  const obra = await prisma.padronUbicacion.upsert({
    where: { tenantId_nombre: { tenantId: tenant.id, nombre: "Obra Reforma 220" } },
    update: {},
    create: { tenantId: tenant.id, nombre: "Obra Reforma 220", tipo: "destino", lat: 19.4326, lng: -99.1332, radioValidacionM: 300 },
  });

  const cliente = await prisma.padronCliente.upsert({
    where: { tenantId_nombre: { tenantId: tenant.id, nombre: "Constructora del Valle" } },
    update: {},
    create: { tenantId: tenant.id, nombre: "Constructora del Valle" },
  });

  // Viajes de ejemplo en distintos estados para ver el dashboard poblado.
  const existentes = await prisma.trip.count({ where: { tenantId: tenant.id } });
  if (existentes === 0) {
    await prisma.trip.create({
      data: {
        tenantId: tenant.id,
        folioOrigen: "V-0001",
        unidadId: unidad1.id,
        productoId: grava.id,
        origenId: cantera.id,
        destinoId: obra.id,
        clienteId: cliente.id,
        bruto: 18500,
        tara: 4500,
        neto: 14000,
        estado: "EN_TRANSITO",
      },
    });

    const entregado = await prisma.trip.create({
      data: {
        tenantId: tenant.id,
        folioOrigen: "V-0002",
        unidadId: unidad2.id,
        productoId: arena.id,
        origenId: cantera.id,
        destinoId: obra.id,
        clienteId: cliente.id,
        bruto: 22000,
        tara: 5000,
        neto: 17000,
        estado: "ENTREGADO",
        validacionEntrega: "AUTOMATICA",
        horaEntrega: new Date(),
      },
    });
    await prisma.evidencia.create({
      data: { tripId: entregado.id, tipo: "ENTREGA_FOTO", url: "/uploads/demo/placeholder.jpg", hash: "seed-hash-2" },
    });

    const conExcepcion = await prisma.trip.create({
      data: {
        tenantId: tenant.id,
        folioOrigen: "V-0003",
        unidadId: unidad1.id,
        productoId: grava.id,
        origenId: cantera.id,
        destinoId: obra.id,
        estado: "EXCEPCION",
      },
    });
    await prisma.excepcion.create({
      data: { tripId: conExcepcion.id, tipo: "GPS_FALTANTE", detalle: "La foto de entrega no trae coordenadas GPS." },
    });
  }

  console.log("Seed listo:", { tenant: tenant.id, admin: admin.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
