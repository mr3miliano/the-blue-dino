import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { ArrowLeft, User, Mail, Lock, ShieldAlert, Heart, Calendar } from 'lucide-react';

export default function Register() {
  const { register } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rol, setRol] = useState('padre'); // 'padre', 'paciente', 'terapeuta'
  
  // Datos específicos del rol
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [etapaVida, setEtapaVida] = useState('6-12');
  const [nivelComunicacion, setNivelComunicacion] = useState('Básico');
  const [especialidad, setEspecialidad] = useState('');
  const [cedula, setCedula] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [loadingLocal, setLoadingLocal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoadingLocal(true);

    // Preparar metadatos según el rol
    const extraData = {};
    if (rol === 'padre') {
      extraData.telefono = telefono;
      extraData.direccion = direccion;
    } else if (rol === 'paciente') {
      extraData.etapa_vida = etapaVida;
      extraData.nivel_comunicacion = nivelComunicacion;
    } else if (rol === 'terapeuta') {
      extraData.especialidad = especialidad;
      extraData.cedula = cedula;
    }

    try {
      await register(email, password, rol, extraData);
      alert('¡Cuenta creada con éxito! Por favor inicia sesión.');
      navigate('/login');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Ocurrió un error al registrar la cuenta.');
    } finally {
      setLoadingLocal(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button 
          style={styles.backBtn} 
          onClick={() => navigate('/')}
          aria-label="Volver atrás"
        >
          <ArrowLeft size={24} />
          <span>Atrás</span>
        </button>

        <div style={styles.header}>
          <h2>Crear una Cuenta</h2>
          <p>Únete a nuestra familia de apoyo y comunicación visual.</p>
        </div>

        {/* Selector de Rol */}
        <div style={styles.tabs}>
          <button 
            type="button"
            style={{
              ...styles.tab,
              ...(rol === 'padre' ? styles.tabActivePadre : {})
            }}
            onClick={() => setRol('padre')}
          >
            Padre / Tutor
          </button>
          <button 
            type="button"
            style={{
              ...styles.tab,
              ...(rol === 'paciente' ? styles.tabActivePaciente : {})
            }}
            onClick={() => setRol('paciente')}
          >
            Hijo (TEA)
          </button>
          <button 
            type="button"
            style={{
              ...styles.tab,
              ...(rol === 'terapeuta' ? styles.tabActiveTerapeuta : {})
            }}
            onClick={() => setRol('terapeuta')}
          >
            Terapeuta
          </button>
        </div>

        {errorMsg && (
          <div style={styles.errorAlert}>
            <ShieldAlert size={20} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Correo Electrónico</label>
            <input
              id="reg-email"
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
            <label className="form-label" htmlFor="reg-pass">Contraseña</label>
            <input
              id="reg-pass"
              className="form-input"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loadingLocal}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirm">Confirmar Contraseña</label>
            <input
              id="reg-confirm"
              className="form-input"
              type="password"
              placeholder="Escribe la contraseña de nuevo"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loadingLocal}
              required
            />
          </div>

          {/* CAMPOS CONDICIONALES POR ROL */}
          
          {rol === 'padre' && (
            <div style={styles.sectionRole}>
              <h4 style={styles.sectionTitle}>Detalles del Padre/Tutor</h4>
              <div className="form-group">
                <label className="form-label" htmlFor="padre-tel">Teléfono de contacto</label>
                <input
                  id="padre-tel"
                  className="form-input"
                  type="tel"
                  placeholder="55-1234-5678"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  disabled={loadingLocal}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="padre-dir">Dirección</label>
                <input
                  id="padre-dir"
                  className="form-input"
                  type="text"
                  placeholder="Ciudad, Estado, País"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  disabled={loadingLocal}
                />
              </div>
            </div>
          )}

          {rol === 'paciente' && (
            <div style={styles.sectionRole}>
              <h4 style={styles.sectionTitle}>Detalles del Paciente (TEA)</h4>
              <div className="form-group">
                <label className="form-label" htmlFor="paciente-etapa">Etapa de Vida</label>
                <select
                  id="paciente-etapa"
                  className="form-input"
                  value={etapaVida}
                  onChange={(e) => setEtapaVida(e.target.value)}
                  disabled={loadingLocal}
                  style={{ height: '52px' }}
                >
                  <option value="6-12">Infantil (6 a 12 años)</option>
                  <option value="13-18">Adolescente (13 a 18 años)</option>
                  <option value="18-25">Joven Adulto (18 a 25 años)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="paciente-com">Nivel de Comunicación</label>
                <select
                  id="paciente-com"
                  className="form-input"
                  value={nivelComunicacion}
                  onChange={(e) => setNivelComunicacion(e.target.value)}
                  disabled={loadingLocal}
                  style={{ height: '52px' }}
                >
                  <option value="Básico">Básico (Pictogramas Simples)</option>
                  <option value="Intermedio">Intermedio (Frases Cortas)</option>
                  <option value="Avanzado">Avanzado (Completo/Funcional)</option>
                </select>
              </div>
            </div>
          )}

          {rol === 'terapeuta' && (
            <div style={styles.sectionRole}>
              <h4 style={styles.sectionTitle}>Detalles del Terapeuta</h4>
              <div className="form-group">
                <label className="form-label" htmlFor="ter-esp">Especialidad</label>
                <input
                  id="ter-esp"
                  className="form-input"
                  type="text"
                  placeholder="Psicólogo Clínico, Neurólogo, etc."
                  value={especialidad}
                  onChange={(e) => setEspecialidad(e.target.value)}
                  disabled={loadingLocal}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ter-ced">Cédula Profesional</label>
                <input
                  id="ter-ced"
                  className="form-input"
                  type="text"
                  placeholder="Número de cédula/registro"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  disabled={loadingLocal}
                />
              </div>
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={styles.submitBtn}
            disabled={loadingLocal}
          >
            {loadingLocal ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>

        <div style={styles.footer}>
          <span>¿Ya tienes cuenta? </span>
          <span 
            style={styles.loginLink} 
            onClick={() => navigate('/login')}
          >
            Inicia sesión aquí
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
    padding: '20px 20px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    padding: '32px',
    maxWidth: '480px',
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
    marginBottom: '16px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '20px',
  },
  tabs: {
    display: 'flex',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-primary)',
    padding: '6px',
    borderRadius: '16px',
    marginBottom: '24px',
    gap: '6px',
  },
  tab: {
    flex: 1,
    padding: '10px 6px',
    fontSize: '0.9rem',
    borderRadius: '12px',
    minHeight: '44px',
    background: 'none',
    color: 'var(--color-text-muted)',
    border: 'none',
    fontWeight: '700',
    cursor: 'pointer',
  },
  tabActivePadre: {
    backgroundColor: 'white',
    color: 'var(--color-brand)',
    boxShadow: 'var(--shadow-sm)',
  },
  tabActivePaciente: {
    backgroundColor: 'white',
    color: 'var(--color-acciones)',
    boxShadow: 'var(--shadow-sm)',
  },
  tabActiveTerapeuta: {
    backgroundColor: 'white',
    color: 'var(--color-cosas)',
    boxShadow: 'var(--shadow-sm)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  sectionRole: {
    border: '2px dashed var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    marginBottom: '20px',
    backgroundColor: '#fafbfd',
  },
  sectionTitle: {
    fontSize: '1rem',
    marginBottom: '12px',
    color: 'var(--color-text-main)',
    borderBottom: '2px solid var(--color-border)',
    paddingBottom: '4px',
  },
  submitBtn: {
    width: '100%',
    marginTop: '8px',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#fef2f2',
    color: 'var(--color-panic)',
    border: '1px solid #fee2e2',
    padding: '12px 16px',
    borderRadius: '12px',
    marginBottom: '20px',
    fontSize: '0.95rem',
    fontWeight: '600',
    textAlign: 'left',
  },
  footer: {
    textAlign: 'center',
    marginTop: '24px',
    fontSize: '0.95rem',
    color: 'var(--color-text-muted)',
    fontWeight: '600',
  },
  loginLink: {
    color: 'var(--color-brand)',
    cursor: 'pointer',
    textDecoration: 'underline',
  }
};
