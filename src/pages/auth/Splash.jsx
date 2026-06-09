import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { Shield, Sparkles } from 'lucide-react';

export default function Splash() {
  const { user, profile, loading, isOffline } = useApp();
  const navigate = useNavigate();

  // Redirección automática si el perfil del usuario ya está cargado
  useEffect(() => {
    if (!loading && user && profile) {
      console.log(`[Splash] Usuario autenticado con rol: ${profile.rol}. Redirigiendo...`);
      if (profile.rol === 'padre') {
        navigate('/padre');
      } else if (profile.rol === 'paciente') {
        navigate('/paciente');
      } else if (profile.rol === 'terapeuta') {
        navigate('/terapeuta');
      }
    }
  }, [user, profile, loading, navigate]);

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Logo de la aplicación */}
        <div style={styles.logoWrapper}>
          <img 
            src="/dino-logo.png" 
            alt="El Dino Azul Logo" 
            style={{ 
              ...styles.logo, 
              animation: loading ? 'pulse 2s infinite ease-in-out' : 'none' 
            }} 
          />
        </div>

        <h1 style={styles.title}>El Dino Azul</h1>
        <p style={styles.subtitle}>
          Comunicación y apoyo visual para personas con TEA
        </p>

        {isOffline && (
          <div style={styles.offlineAlert}>
            <Shield size={20} /> Modo Offline Activo - Funciones Críticas Disponibles
          </div>
        )}

        {loading ? (
          <div style={styles.loadingArea}>
            <div style={styles.spinner}></div>
            <p style={styles.loadingText}>Buscando a tu amigo Dino...</p>
          </div>
        ) : (
          !user && (
            <div style={styles.buttonGroup}>
              <button 
                className="btn btn-primary" 
                style={styles.btnBig}
                onClick={() => navigate('/login')}
              >
                Ingresar
              </button>
              <button 
                className="btn btn-secondary" 
                style={styles.btnBig}
                onClick={() => navigate('/register')}
              >
                Crear una cuenta
              </button>
            </div>
          )
        )}
      </div>

      {/* Estilo local de animación CSS */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 0.9; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    padding: '20px',
    textAlign: 'center',
  },
  content: {
    maxWidth: '480px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  logoWrapper: {
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    backgroundColor: 'white',
    padding: '16px',
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
  },
  logo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  title: {
    fontSize: '2.5rem',
    color: 'var(--color-brand)',
    margin: 0,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: '1.2rem',
    color: 'var(--color-text-muted)',
    margin: '0 0 16px 0',
    fontWeight: '500',
  },
  offlineAlert: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#ecfdf5',
    color: '#065f46',
    border: '1px solid #a7f3d0',
    padding: '10px 18px',
    borderRadius: '12px',
    fontWeight: 'bold',
    fontSize: '0.95rem',
  },
  loadingArea: {
    marginTop: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(59, 130, 246, 0.1)',
    borderTopColor: 'var(--color-brand)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '1.1rem',
    color: 'var(--color-text-muted)',
    fontWeight: '600',
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    width: '100%',
    marginTop: '24px',
  },
  btnBig: {
    width: '100%',
    fontSize: '1.2rem',
    padding: '16px 20px',
    borderRadius: '16px',
  }
};
