// MVP: sin login real todavía (el brief no define el flujo de auth, solo
// roles). El tenant activo se guarda en localStorage para poder cambiarlo
// desde la UI mientras se conecta un login de verdad.
const KEY = "traza:tenantId";

export function getTenantId(): string {
  return localStorage.getItem(KEY) ?? "tenant-demo";
}

export function setTenantId(id: string) {
  localStorage.setItem(KEY, id);
}
