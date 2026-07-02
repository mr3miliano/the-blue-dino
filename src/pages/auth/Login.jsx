import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { ArrowLeft, Mail, Lock, AlertTriangle } from 'lucide-react';

export default function Login() {
  const { login } = useApp();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingLocal, setLoadingLocal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Por favor completa todos los campos.');
      return;
    }

    setErrorMsg('');
    setLoadingLocal(true);

    try {
      await login(email, password);
      // Redirigir al inicio, que a su vez enviará al dashboard correcto
      navigate('/');
    } catch (err) {
      console.error(err);
      setErrorMsg('Usuario o contraseña incorrectos. Verifica e intenta de nuevo.');
    } finally {
      setLoadingLocal(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Botón de Atrás */}
        <button 
          style={styles.backBtn} 
          onClick={() => navigate('/')}
          aria-label="Volver atrás"
        >
          <ArrowLeft size={24} />
          <span>Atrás</span>
        </button>

        <div style={styles.header}>
          <img src="/dino-logo.png" alt="Dino" style={styles.dinoIcon} />
          <h2>¡Hola de nuevo!</h2>
          <p>Ingresa tus datos para continuar jugando y aprendiendo.</p>
        </div>

        {errorMsg && (
          <div id="error-alert" style={styles.errorAlert}>
            <AlertTriangle size={20} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="email-input">
              <Mail size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Correo Electrónico
            </label>
            <input
              id="email-input"
              className="form-input"
              type="email"
              placeholder="ejemplo@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loadingLocal}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">
              <Lock size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Contraseña
            </label>
            <input
              id="password-input"
              className="form-input"
              type="password"
              placeholder="Escribe tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loadingLocal}
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={styles.submitBtn}
            disabled={loadingLocal}
          >
            {loadingLocal ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={styles.footer}>
          <span>¿No tienes una cuenta? </span>
          <span 
            style={styles.registerLink} 
            onClick={() => navigate('/register')}
          >
            Regístrate aquí
          </span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    padding: '20px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    padding: '32px',
    maxWidth: '440px',
    width: '100%',
    position: 'relative',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-brand)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: 0,
    minHeight: 'auto',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
    marginBottom: '20px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  dinoIcon: {
    width: '70px',
    height: '70px',
    objectFit: 'contain',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  submitBtn: {
    width: '100%',
    marginTop: '12px',
    fontSize: '1.15rem',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#fff5f5',
    color: '#e53e3e',
    border: '2px solid #feb2b2',
    padding: '16px',
    borderRadius: '16px',
    marginBottom: '20px',
    fontSize: '1rem',
    fontWeight: 'bold',
    textAlign: 'left',
    boxShadow: '0 10px 15px -3px rgba(229, 62, 62, 0.1)',
  },
  footer: {
    textAlign: 'center',
    marginTop: '24px',
    fontSize: '0.95rem',
    color: 'var(--color-text-muted)',
    fontWeight: '600',
  },
  registerLink: {
    color: 'var(--color-brand)',
    cursor: 'pointer',
    textDecoration: 'underline',
  }
};
