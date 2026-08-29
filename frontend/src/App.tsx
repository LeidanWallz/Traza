import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { getTenantId, setTenantId } from "./tenant";
import { contarPendientes, sincronizarPendientes } from "./offlineQueue";
import { API_CONFIGURADA } from "./config";
import Dashboard from "./pages/Dashboard";
import Excepciones from "./pages/Excepciones";
import CapturaOrigen from "./pages/CapturaOrigen";
import CerrarEntrega from "./pages/CerrarEntrega";

function TrazaIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 18 L12 6 L20 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="6" r="1.6" fill="currentColor" />
    </svg>
  );
}

export default function App() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pendientes, setPendientes] = useState(0);
  const [tenant, setTenant] = useState(getTenantId());

  useEffect(() => {
    const actualizarPendientes = () => contarPendientes().then(setPendientes);
    actualizarPendientes();

    const onOnline = () => {
      setOnline(true);
      sincronizarPendientes().then(actualizarPendientes);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const heartbeat = setInterval(() => {
      sincronizarPendientes().then(actualizarPendientes);
    }, 15000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(heartbeat);
    };
  }, []);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <TrazaIcon />
          Traza
        </div>
        <div className="topbar-right">
          {pendientes > 0 && <span className="pill pill-pending">{pendientes} sin sincronizar</span>}
          <span className={`pill ${online ? "pill-online" : "pill-offline"}`}>
            <span className="pill-dot" />
            {online ? "En línea" : "Sin conexión"}
          </span>
          <input
            className="tenant-input"
            value={tenant}
            onChange={(e) => {
              setTenant(e.target.value);
              setTenantId(e.target.value);
            }}
            title="Tenant activo"
          />
        </div>
      </header>

      <nav className="tabs">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Dashboard
        </NavLink>
        <NavLink to="/excepciones" className={({ isActive }) => (isActive ? "active" : "")}>
          Excepciones
        </NavLink>
        <NavLink to="/captura" className={({ isActive }) => (isActive ? "active" : "")}>
          Captura de origen
        </NavLink>
        <NavLink to="/entrega" className={({ isActive }) => (isActive ? "active" : "")}>
          Cerrar entrega
        </NavLink>
      </nav>

      <main>
        {!API_CONFIGURADA && (
          <div className="form-msg err" style={{ marginBottom: 20 }}>
            Falta configurar VITE_API_URL: el frontend no sabe dónde está el backend. Configúrala como variable de
            entorno en Vercel (URL del backend) y vuelve a desplegar.
          </div>
        )}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/excepciones" element={<Excepciones />} />
          <Route path="/captura" element={<CapturaOrigen />} />
          <Route path="/entrega" element={<CerrarEntrega />} />
        </Routes>
      </main>
    </>
  );
}
