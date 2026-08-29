# Traza

SaaS B2B para digitalizar viajes de materia prima / carga a granel (wedge:
acarreo de construcción con vale de báscula). Ver `TRAZA_BRIEF_CLAUDE_CODE.md`
para el contexto de negocio completo.

## Estructura

```
backend/   Node + Express + Prisma + PostgreSQL + Socket.io
frontend/  React + Vite, PWA con soporte offline
```

## Arrancar en desarrollo

Requiere PostgreSQL corriendo localmente.

```bash
# Backend
cd backend
cp .env.example .env        # ajusta DATABASE_URL si aplica
npm install
npx prisma migrate dev      # crea el esquema
npm run seed                # tenant + padrón + viajes de ejemplo
npm run dev                 # http://localhost:4000

# Frontend (otra terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

El frontend usa el tenant `tenant-demo` (creado por el seed) por default —
se puede cambiar desde el campo de tenant en la barra superior.

## Pruebas

```bash
cd backend
npm test        # máquina de estados + motor de reglas (dominio puro)
```

## Estado del MVP

Implementado según `TRAZA_BRIEF_CLAUDE_CODE.md` §7:

- Captura de origen: documento u OCR-pendiente / captura nativa (`POST /trips`)
- Cierre de entrega con foto + GPS obligatorio (`POST /trips/:id/entrega`)
- Motor de reglas: duplicado, cantidad imposible, timeout, GPS faltante,
  destino no coincide
- Conciliación (`POST /trips/:id/conciliar`)
- Dashboard de turno en vivo (Socket.io) y bandeja de excepciones
- Multi-tenant por header `x-tenant-id` (placeholder hasta que se defina auth real)
- PWA con app shell offline y cola de captura en IndexedDB para chofer sin señal

Pendiente y fuera de alcance del día 1: extracción OCR real (los campos se
capturan manualmente por ahora), autenticación/login, CRUD de administración
del padrón, export de prefactura.
