import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { supabase } from '../../services/supabase';
import { 
  Users, Trash2, FileText, MapPin, Clock, LogOut, Activity, AlertTriangle, WifiOff
} from 'lucide-react';

export default function TerapeutaDashboard() {
  const [showTestBanner, setShowTestBanner] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowTestBanner(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Lista de pacientes del terapeuta
  const [pacientes, setPacientes] = useState([]);
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  
  // Inputs para vinculación
  const [emailPaciente, setEmailPaciente] = useState('');
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  // Formularios de Expediente
  const [diagnostico, setDiagnostico] = useState('');
  const [notas, setNotas] = useState('');
  const [avance, setAvance] = useState('Estable'); // 'Excelente', 'Mejorando', 'Estable', 'Requiere Apoyo'
  const [loadingSave, setLoadingSave] = useState(false);

  // Historial del paciente seleccionado
  const [expedientes, setExpedientes] = useState([]);
  const [alertas, setAlertas] = useState([]);

  // Funciones de carga de datos (declaradas antes de useEffect)
  const fetchPacientes = useCallback(async () => {
    if (!profile?.id_usuario) return;
    try {
      const { data, error } = await supabase
        .from('terapeutas_pacientes')
        .select(`
          id_paciente,
          pacientes (
            etapa_vida,
            nivel_comunicacion,
            usuarios (
              correo
            )
          )
        `)
        .eq('id_terapeuta', profile.id_usuario);

      if (error) throw error;

      const formatted = (data || [])
        .filter(item => item && item.pacientes && item.pacientes.usuarios)
        .map(item => ({
          id_paciente: item.id_paciente,
          etapa_vida: item.pacientes.etapa_vida,
          nivel_comunicacion: item.pacientes.nivel_comunicacion,
          correo: item.pacientes.usuarios.correo
        }));

      setPacientes(formatted);
      setSelectedPaciente(prev => {
        if (formatted.length === 0) return null;
        if (!prev || !formatted.some(p => p.id_paciente === prev.id_paciente)) {
          return formatted[0];
        }
        return prev;
      });
    } catch (err) {
      console.error('Error al cargar pacientes:', err);
    }
  }, [profile]);

  const fetchPacienteHistorial = useCallback(async (pacienteId) => {
    try {
      const { data, error } = await supabase
        .from('expedientes')
        .select('*')
        .eq('id_paciente', pacienteId)
        .order('fecha_actualizacion', { ascending: false });

      if (error) throw error;
      setExpedientes(data || []);
    } catch (err) {
      console.error('Error al cargar expedientes:', err);
    }
  }, []);

  const fetchPacienteAlertas = useCallback(async (pacienteId) => {
    try {
      const { data, error } = await supabase
        .from('alertas')
        .select('*')
        .eq('id_paciente', pacienteId)
        .order('fecha', { ascending: false });

      if (error) throw error;
      setAlertas(data || []);
    } catch (err) {
      console.error('Error al cargar alertas:', err);
    }
  }, []);

  // 1. Cargar pacientes asignados al iniciar
  useEffect(() => {
    if (profile) {
      Promise.resolve().then(() => {
        fetchPacientes();
      });
    }
  }, [profile, fetchPacientes]);

  // 2. Cargar historial del paciente al cambiar selección
  useEffect(() => {
    if (selectedPaciente) {
      Promise.resolve().then(() => {
        fetchPacienteHistorial(selectedPaciente.id_paciente);
        fetchPacienteAlertas(selectedPaciente.id_paciente);
      });
    }
  }, [selectedPaciente, fetchPacienteHistorial, fetchPacienteAlertas]);

  // Vincular un nuevo paciente por correo (CRUD - Create)
  const handleVincularPaciente = async (e) => {
    e.preventDefault();
    if (!emailPaciente) return;

    setStatusMsg({ text: 'Buscando paciente...', type: 'info' });
    try {
      // 1. Buscar usuario por correo
      const { data: userRecord, error: userErr } = await supabase
        .from('usuarios')
        .select('id_usuario, rol')
        .eq('correo', emailPaciente.trim().toLowerCase())
        .single();

      if (userErr || !userRecord) {
        setStatusMsg({ text: 'No se encontró ningún paciente con ese correo.', type: 'error' });
        return;
      }

      if (userRecord.rol !== 'paciente') {
        setStatusMsg({ text: 'El correo no corresponde a un usuario paciente.', type: 'error' });
        return;
      }

      // 2. Insertar en terapeutas_pacientes
      const { error: linkErr } = await supabase
        .from('terapeutas_pacientes')
        .insert([{
          id_terapeuta: profile.id_usuario,
          id_paciente: userRecord.id_usuario
        }]);

      if (linkErr) {
        if (linkErr.code === '23505') {
          setStatusMsg({ text: 'Este paciente ya está asignado a tu lista.', type: 'error' });
        } else {
          throw linkErr;
        }
        return;
      }

      setStatusMsg({ text: 'Paciente asignado con éxito.', type: 'success' });
      setEmailPaciente('');
      fetchPacientes();
    } catch (err) {
      console.error(err);
      setStatusMsg({ text: 'Error al asignar el paciente.', type: 'error' });
    }
  };

  // Desvincular paciente de la lista (CRUD - Delete)
  const handleDesvincularPaciente = async (pacienteId) => {
    if (!window.confirm('¿Estás seguro de desvincular a este paciente de tu supervisión?')) return;

    try {
      const { error } = await supabase
        .from('terapeutas_pacientes')
        .delete()
        .eq('id_terapeuta', profile.id_usuario)
        .eq('id_paciente', pacienteId);

      if (error) throw error;

      setStatusMsg({ text: 'Paciente desvinculado con éxito.', type: 'success' });
      if (selectedPaciente?.id_paciente === pacienteId) {
        setSelectedPaciente(null);
      }
      fetchPacientes();
    } catch (err) {
      console.error(err);
      setStatusMsg({ text: 'Error al desvincular paciente.', type: 'error' });
    }
  };

  // Crear/Actualizar expediente clínico (Cargar Reporte)
  const handleSaveExpediente = async (e) => {
    e.preventDefault();
    if (!selectedPaciente || !diagnostico.trim() || !notas.trim()) {
      alert('Por favor, completa diagnóstico y notas clínicas.');
      return;
    }

    setLoadingSave(true);
    try {
      const { error } = await supabase
        .from('expedientes')
        .insert([{
          id_paciente: selectedPaciente.id_paciente,
          id_terapeuta: profile.id_usuario,
          diagnostico: diagnostico.trim(),
          notas: notas.trim(),
          avance: avance
        }]);

      if (error) throw error;

      setStatusMsg({ text: 'Expediente actualizado exitosamente.', type: 'success' });
      setDiagnostico('');
      setNotas('');
      fetchPacienteHistorial(selectedPaciente.id_paciente);
    } catch (err) {
      console.error(err);
      setStatusMsg({ text: 'Error al guardar expediente.', type: 'error' });
    } finally {
      setLoadingSave(false);
    }
  };

  return (
    <div style={styles.dashboardContainer}>
      {/* Sidebar Terapeuta */}
      <div style={styles.sidebar}>
        <div style={styles.brandArea}>
          <img src="/dino-logo.png" alt="Dino" style={styles.sidebarLogo} />
          <h3>Portal Terapeuta</h3>
          <span style={styles.userEmail}>{profile.correo}</span>
        </div>

        <div style={styles.assignedSection}>
          <h4 style={{ marginBottom: 12, fontSize: '0.95rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={16} /> Pacientes Asignados ({pacientes.length})
          </h4>
          
          <div style={styles.pacientesList}>
            {pacientes.map(pac => (
              <div 
                key={pac.id_paciente}
                style={{
                  ...styles.pacienteItem,
                  backgroundColor: selectedPaciente?.id_paciente === pac.id_paciente ? 'var(--color-brand-light)' : 'transparent',
                  borderColor: selectedPaciente?.id_paciente === pac.id_paciente ? 'var(--color-brand)' : 'transparent'
                }}
                onClick={() => setSelectedPaciente(pac)}
              >
                <div style={{ flexGrow: 1, textAlign: 'left', overflow: 'hidden' }}>
                  <p style={{ fontWeight: 'bold', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {pac.correo}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Etapa: {pac.etapa_vida} | {pac.nivel_comunicacion}
                  </span>
                </div>
                <button 
                  style={styles.deleteMiniBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDesvincularPaciente(pac.id_paciente);
                  }}
                  aria-label="Desvincular paciente"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <button style={styles.logoutBtn} onClick={logout}>
          <LogOut size={20} /> Cerrar Sesión
        </button>
      </div>

      {/* Main Content Area */}
      <div style={styles.mainContent}>
        {showTestBanner && (
          <div id="dashboard-success-banner" style={styles.testBanner}>
            <div style={styles.testBannerContent}>
              <span style={{ fontSize: '1.4rem' }}>🎉</span>
              <div style={{ textAlign: 'left' }}>
                <strong>¡Prueba de Autenticación Exitosa!</strong>
                <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                  Se inició sesión correctamente y se cargó el Dashboard para el rol de TERAPEUTA.
                </div>
              </div>
              <button onClick={() => setShowTestBanner(false)} style={styles.testBannerClose}>&times;</button>
            </div>
          </div>
        )}

        {isOffline && (
          <div style={styles.offlineBanner}>
            <WifiOff size={18} /> Estás sin conexión. Los reportes clínicos requieren conexión a internet.
          </div>
        )}

        {statusMsg.text && (
          <div style={{
            ...styles.alert,
            backgroundColor: statusMsg.type === 'success' ? '#ecfdf5' : statusMsg.type === 'error' ? '#fef2f2' : '#eff6ff',
            color: statusMsg.type === 'success' ? '#065f46' : statusMsg.type === 'error' ? '#991b1b' : '#1e40af',
            border: `1px solid ${statusMsg.type === 'success' ? '#a7f3d0' : statusMsg.type === 'error' ? '#fecaca' : '#bfdbfe'}`
          }}>
            <span>{statusMsg.text}</span>
            <button style={styles.alertClose} onClick={() => setStatusMsg({ text: '', type: '' })}>x</button>
          </div>
        )}

        {/* Cargar Pacientes (CRUD) y Ficha */}
        <section style={styles.topSection}>
          <div className="card" style={{ flex: 1 }}>
            <h3 style={{ marginBottom: 14 }}>Asignar Nuevo Paciente</h3>
            <form onSubmit={handleVincularPaciente} style={{ display: 'flex', gap: 12 }}>
              <input
                className="form-input"
                type="email"
                placeholder="Ingresa el correo del paciente..."
                value={emailPaciente}
                onChange={(e) => setEmailPaciente(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary">
                Asignar
              </button>
            </form>
          </div>
        </section>

        {selectedPaciente ? (
          <div style={styles.dashboardGrid}>
            {/* Columna Izquierda: Cargar Reporte Clínico */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="card">
                <div style={styles.panelHeader}>
                  <Activity size={22} color="var(--color-brand)" />
                  <h3>Registrar Reporte de Avance</h3>
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
                  Añade notas de progreso clínico para {selectedPaciente.correo}
                </p>

                <form onSubmit={handleSaveExpediente} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="exp-diag">Diagnóstico General</label>
                    <input
                      id="exp-diag"
                      className="form-input"
                      type="text"
                      placeholder="Ej: Trastorno del Espectro Autista Grado 1"
                      value={diagnostico}
                      onChange={(e) => setDiagnostico(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="exp-notas">Notas Clínicas y Observaciones</label>
                    <textarea
                      id="exp-notas"
                      className="form-input"
                      placeholder="Ej: Se observa mejora en la comunicación espontánea usando pictogramas..."
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      style={{ minHeight: '140px', resize: 'none' }}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="exp-avance">Avance de Sesión</label>
                    <select
                      id="exp-avance"
                      className="form-input"
                      value={avance}
                      onChange={(e) => setAvance(e.target.value)}
                      style={{ height: '52px' }}
                    >
                      <option value="Excelente">Excelente Avance</option>
                      <option value="Mejorando">Mejorando Progresivamente</option>
                      <option value="Estable">Estable (Sin Cambios)</option>
                      <option value="Requiere Apoyo">Requiere Refuerzo</option>
                    </select>
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loadingSave || isOffline}
                  >
                    {loadingSave ? 'Guardando...' : 'Cargar al Expediente'}
                  </button>
                </form>
              </div>

              {/* Alertas de Pánico del Paciente */}
              <div className="card">
                <div style={styles.panelHeader}>
                  <AlertTriangle size={22} color="var(--color-panic)" />
                  <h3>Historial de Alertas de Auxilio</h3>
                </div>
                {alertas.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                    Este paciente no ha activado el botón de pánico recientemente.
                  </p>
                ) : (
                  <div style={styles.alertList}>
                    {alertas.map(al => (
                      <div key={al.id_alerta} style={styles.alertListItem}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-panic)' }}>
                          <MapPin size={16} />
                          <strong>Ubicación: {al.ubicacion}</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                          <Clock size={14} />
                          <span>{new Date(al.fecha).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Columna Derecha: Expedientes / Historial Completo */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={styles.panelHeader}>
                <FileText size={22} color="var(--color-brand)" />
                <h3>Expediente Clínico Histórico</h3>
              </div>
              
              <div style={styles.timelineContainer}>
                {expedientes.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)' }}>No hay reportes clínicos en el historial.</p>
                ) : (
                  expedientes.map(exp => (
                    <div key={exp.id_expediente} style={styles.timelineItem}>
                      <div style={styles.timelineBadge}>
                        {exp.id_terapeuta ? 'Terapeuta' : 'Padre'}
                      </div>
                      <div style={styles.timelineContent}>
                        <div style={styles.timelineHeader}>
                          <strong>{exp.diagnostico}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            {new Date(exp.fecha_actualizacion).toLocaleDateString()}
                          </span>
                        </div>
                        <p style={{ margin: '8px 0', fontSize: '0.95rem', color: 'var(--color-text-main)', whiteSpace: 'pre-wrap' }}>
                          {exp.notas}
                        </p>
                        {exp.avance && (
                          <div style={styles.timelineAvance}>
                            ✓ Avance: <span style={{ fontWeight: 'bold' }}>{exp.avance}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <Users size={48} color="var(--color-text-muted)" style={{ marginBottom: 16 }} />
            <h3>No hay ningún paciente seleccionado</h3>
            <p style={{ color: 'var(--color-text-muted)', marginTop: 8 }}>
              Por favor selecciona o asigna un paciente de tu barra lateral para gestionar su historial y expedientes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  dashboardContainer: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)'
  },
  sidebar: {
    width: '300px',
    backgroundColor: 'white',
    borderRight: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    flexShrink: 0
  },
  brandArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '24px',
    borderBottom: '2px solid var(--color-border)',
    paddingBottom: '16px'
  },
  sidebarLogo: {
    width: '64px',
    height: '64px',
    objectFit: 'contain',
    marginBottom: '8px'
  },
  userEmail: {
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
    marginTop: '4px',
    fontWeight: '600'
  },
  assignedSection: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto'
  },
  pacientesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '8px'
  },
  pacienteItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)'
  },
  deleteMiniBtn: {
    padding: '0',
    width: '28px',
    height: '28px',
    minHeight: '28px',
    borderRadius: '8px',
    backgroundColor: '#fee2e2',
    color: 'var(--color-panic)',
    border: '1px solid #fecaca',
    marginLeft: '8px',
    flexShrink: 0
  },
  logoutBtn: {
    backgroundColor: '#fef2f2',
    color: 'var(--color-panic)',
    border: '1px solid #fee2e2',
    marginTop: '20px',
    width: '100%',
    borderRadius: '12px'
  },
  mainContent: {
    flexGrow: 1,
    padding: '32px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  offlineBanner: {
    backgroundColor: '#fffbeb',
    color: '#b45309',
    padding: '12px 18px',
    borderRadius: '12px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  alert: {
    padding: '16px 20px',
    borderRadius: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 'bold'
  },
  alertClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '1.2rem',
    minHeight: 'auto',
    padding: '0 4px',
    color: 'inherit'
  },
  topSection: {
    display: 'flex',
    gap: '24px',
    flexShrink: 0
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr',
    gap: '24px',
    alignItems: 'start'
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
    borderBottom: '2px solid var(--color-border)',
    paddingBottom: '8px'
  },
  alertList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '12px'
  },
  alertListItem: {
    padding: '12px',
    borderRadius: '12px',
    backgroundColor: '#fafbfd',
    border: '1px solid var(--color-border)',
    textAlign: 'left'
  },
  timelineContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginTop: '12px'
  },
  timelineItem: {
    display: 'flex',
    gap: '12px',
    textAlign: 'left'
  },
  timelineBadge: {
    padding: '4px 8px',
    borderRadius: '8px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    backgroundColor: 'var(--color-brand-light)',
    color: 'var(--color-brand)',
    alignSelf: 'start',
    flexShrink: 0
  },
  timelineContent: {
    flexGrow: 1,
    paddingBottom: '16px',
    borderBottom: '1px solid var(--color-border)'
  },
  timelineHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  timelineAvance: {
    fontSize: '0.85rem',
    color: '#047857'
  },
  testBanner: {
    backgroundColor: '#ecfdf5',
    border: '3px solid #10b981',
    borderRadius: '16px',
    padding: '16px 20px',
    marginBottom: '24px',
    boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.1)',
    animation: 'slideDown 0.3s ease-out',
  },
  testBannerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    color: '#065f46',
    fontSize: '1rem',
    fontWeight: '600',
    position: 'relative',
  },
  testBannerClose: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: '#065f46',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: '1',
  }
};
