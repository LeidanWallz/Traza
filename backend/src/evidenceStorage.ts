import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Adaptador de storage de evidencia. La foto original es inmutable y se
// guarda con su hash (§3). Esta implementación usa disco local para no
// depender de credenciales de nube en desarrollo — cualquier bucket
// compatible S3 implementa la misma forma (guardar buffer, regresar url+hash).

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

export interface EvidenciaGuardada {
  url: string;
  hash: string;
}

export async function guardarEvidencia(tenantId: string, buffer: Buffer, extension: string): Promise<EvidenciaGuardada> {
  const hash = createHash("sha256").update(buffer).digest("hex");
  const dir = path.join(UPLOADS_DIR, tenantId);
  await mkdir(dir, { recursive: true });
  const filename = `${hash}.${extension}`;
  await writeFile(path.join(dir, filename), buffer);
  return { url: `/uploads/${tenantId}/${filename}`, hash };
}
