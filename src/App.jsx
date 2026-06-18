import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './store/AppContext';
import Splash from './pages/auth/Splash';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import PadreDashboard from './pages/padre/PadreDashboard';
import PacienteDashboard from './pages/paciente/PacienteDashboard';
import TerapeutaDashboard from './pages/terapeuta/TerapeutaDashboard';
import './App.css';

// Componente para proteger rutas según el rol del usuario
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/');
      } else if (profile && !allowedRoles.includes(profile.rol)) {
        // Si tiene sesión pero intenta entrar a un dashboard de otro rol, redirigir a raíz para ruteo automático
        navigate('/');
      }
    }
  }, [user, profile, loading, navigate, allowedRoles]);

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div className="spinner" style={styles.spinner}></div>
        <p style={{ marginTop: 12, fontWeight: 'bold', color: 'var(--color-text-muted)' }}>
          Cargando entorno seguro...
        </p>
      </div>
    );
  }

  return user && profile && allowedRoles.includes(profile.rol) ? children : null;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Rutas Públicas */}
      <Route path="/" element={<Splash />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Rutas Privadas Protegidas por Rol */}
      <Route 
        path="/padre" 
        element={
          <ProtectedRoute allowedRoles={['padre']}>
            <PadreDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/paciente" 
        element={
          <ProtectedRoute allowedRoles={['paciente']}>
            <PacienteDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/terapeuta" 
        element={
          <ProtectedRoute allowedRoles={['terapeuta']}>
            <TerapeutaDashboard />
          </ProtectedRoute>
        } 
      />

      {/* Redirección por defecto */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <AppProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AppProvider>
  );
}

const styles = {
  loadingScreen: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'var(--bg-primary)',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(59, 130, 246, 0.1)',
    borderTopColor: 'var(--color-brand)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  }
};

export default App;
