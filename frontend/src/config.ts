// En desarrollo, Vite proxea /api y /socket.io al backend local (vite.config.ts),
// así que las rutas se piden con el prefijo /api. En producción (p. ej.
// Vercel, que solo sirve el frontend estático) el backend vive en otro
// dominio — VITE_API_URL debe ser el origen completo del backend (sin
// prefijo, porque ahí las rutas cuelgan de la raíz: /trips, /excepciones…).
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "/api" : "");

export const API_CONFIGURADA = API_BASE_URL !== "";

/** Origen del backend para Socket.io — undefined en dev (same-origin + proxy de Vite). */
export const BACKEND_ORIGIN: string | undefined = import.meta.env.VITE_API_URL;
