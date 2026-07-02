import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { supabase } from '../../services/supabase';
import { searchPictograms, resolveCategory } from '../../services/arasaac';
import { speakText } from '../../services/googleVoice';
import { sendMessageNotification } from '../../services/firebase';
import { queueMessage } from '../../services/offlineSync';
import { 
  User, Users, MessageSquare, BookOpen, LogOut, Plus, 
  Send, Volume2, FileText, WifiOff
} from 'lucide-react';

export default function PadreDashboard() {
  const { profile, logout, isOffline } = useApp();
  const [activeTab, setActiveTab] = useState('hijos'); // 'hijos', 'pictos', 'chat', 'expediente'
  const [showTestBanner, setShowTestBanner] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowTestBanner(false), 5000);
    return () => clearTimeout(timer);
  }, []);
  
  // Pacientes vinculados
  const [linkedHijos, setLinkedHijos] = useState([]);
  const [selectedHijo, setSelectedHijo] = useState(null);
  
  // Inputs para vinculación
  const [emailHijo, setEmailHijo] = useState('');
  const [emailTerapeuta, setEmailTerapeuta] = useState('');
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  
  // Terapeutas vinculados al hijo seleccionado
  const [hijoTerapeutas, setHijoTerapeutas] = useState([]);

  // Creador de pictogramas (Texto -> Picto)
  const [inputText, setInputText] = useState('');
  const [phrasePictos, setPhrasePictos] = useState([]);
  const [loadingPictos, setLoadingPictos] = useState(false);

  // Chat en tiempo real
  const [chatMessages, setChatMessages] = useState([]);
  const [newMsgText, setNewMsgText] = useState('');
  const chatEndRef = useRef(null);

  // Expediente
  const [expedientes, setExpedientes] = useState([]);
  const [nuevaNota, setNuevaNota] = useState('');

  const fetchLinkedHijos = useCallback(async () => {
    if (!profile?.id_usuario) return;
    try {
      // Consultar tabla de relación
      const { data, error } = await supabase
        .from('padres_pacientes')
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
        .eq('id_padre', profile.id_usuario);

      if (error) throw error;

      const formatted = (data || []).map(item => ({
        id_paciente: item.id_paciente,
        etapa_vida: item.pacientes.etapa_vida,
        nivel_comunicacion: item.pacientes.nivel_comunicacion,
        correo: item.pacientes.usuarios.correo
      }));

      setLinkedHijos(formatted);
      setSelectedHijo(prev => {
        if (formatted.length === 0) return null;
        if (!prev || !formatted.some(h => h.id_paciente === prev.id_paciente)) {
          return formatted[0];
        }
        return prev;
      });
    } catch (error) {
      console.error('Error al cargar hijos:', error);
    }
  }, [profile]);

  const fetchHijoTerapeutas = useCallback(async (hijoId) => {
    try {
      const { data, error } = await supabase
        .from('terapeutas_pacientes')
        .select(`
          id_terapeuta,
          terapeutas (
            especialidad,
            cedula,
            usuarios (
              correo
            )
          )
        `)
        .eq('id_paciente', hijoId);

      if (error) throw error;

      const formatted = (data || []).map(item => ({
        id_terapeuta: item.id_terapeuta,
        especialidad: item.terapeutas.especialidad,
        cedula: item.terapeutas.cedula,
        correo: item.terapeutas.usuarios.correo
      }));

      setHijoTerapeutas(formatted);
    } catch (error) {
      console.error('Error al cargar terapeutas del hijo:', error);
    }
  }, []);

  const fetchChatMessages = useCallback(async (hijoId) => {
    if (!profile?.id_usuario) return;
    try {
      const { data, error } = await supabase
        .from('mensajes')
        .select('*')
        .or(`and(emisor_id.eq.${profile.id_usuario},receptor_id.eq.${hijoId}),and(emisor_id.eq.${hijoId},receptor_id.eq.${profile.id_usuario})`)
        .order('fecha', { ascending: true });

      if (error) throw error;
      setChatMessages(data || []);
    } catch (error) {
      console.error('Error al cargar chat:', error);
    }
  }, [profile]);

  const fetchExpedientes = useCallback(async (hijoId) => {
    try {
      const { data, error } = await supabase
        .from('expedientes')
        .select('*')
        .eq('id_paciente', hijoId)
        .order('fecha_actualizacion', { ascending: false });

      if (error) throw error;
      setExpedientes(data || []);
    } catch (error) {
      console.error('Error al cargar expediente:', error);
    }
  }, []);

  // 1. Cargar pacientes vinculados al padre al iniciar
  useEffect(() => {
    if (profile) {
      Promise.resolve().then(() => {
        fetchLinkedHijos();
      });
    }
  }, [profile, fetchLinkedHijos]);

  // 2. Cargar datos específicos cuando cambia el hijo seleccionado
  useEffect(() => {
    if (selectedHijo) {
      Promise.resolve().then(() => {
        fetchHijoTerapeutas(selectedHijo.id_paciente);
        fetchChatMessages(selectedHijo.id_paciente);
        fetchExpedientes(selectedHijo.id_paciente);
      });

      // Suscribirse a mensajes en tiempo real con Supabase
      const channel = supabase
        .channel(`chat_${selectedHijo.id_paciente}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'mensajes',
            filter: `emisor_id=eq.${selectedHijo.id_paciente}`,
          },
          (payload) => {
            console.log('[Realtime] Nuevo mensaje del hijo recibido:', payload.new);
            setChatMessages(prev => [...prev, payload.new]);
            sendMessageNotification(selectedHijo.correo, payload.new.mensaje);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedHijo, fetchHijoTerapeutas, fetchChatMessages, fetchExpedientes]);

  // Auto-scroll en chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);



  // Vincular Hijo
  const handleVincularHijo = async (e) => {
    e.preventDefault();
    if (!emailHijo) return;

    if (linkedHijos.length >= 3) {
      setStatusMsg({ text: 'No puedes vincular más de 3 pacientes (límite de 3 alcanzado).', type: 'error' });
      return;
    }

    setStatusMsg({ text: 'Buscando...', type: 'info' });
    try {
      // 1. Encontrar el id_usuario en la base de datos
      const { data: userRecord, error: userErr } = await supabase
        .from('usuarios')
        .select('id_usuario, rol')
        .eq('correo', emailHijo.trim().toLowerCase())
        .single();

      if (userErr || !userRecord) {
        setStatusMsg({ text: 'No se encontró ningún usuario con ese correo.', type: 'error' });
        return;
      }

      if (userRecord.rol !== 'paciente') {
        setStatusMsg({ text: 'El correo corresponde a un usuario que no es paciente.', type: 'error' });
        return;
      }

      // Validar límite de padres del paciente (máximo 2)
      const { data: parentsData, error: parentsErr } = await supabase
        .from('padres_pacientes')
        .select('id_padre')
        .eq('id_paciente', userRecord.id_usuario);

      if (parentsErr) throw parentsErr;

      if (parentsData && parentsData.length >= 2) {
        setStatusMsg({ text: 'Este paciente ya tiene el número máximo de tutores vinculados (máximo 2).', type: 'error' });
        return;
      }

      // 2. Insertar relación
      const { error: linkErr } = await supabase
        .from('padres_pacientes')
        .insert([{ id_padre: profile.id_usuario, id_paciente: userRecord.id_usuario }]);

      if (linkErr) {
        if (linkErr.code === '23505') {
          setStatusMsg({ text: 'Este paciente ya está vinculado a tu cuenta.', type: 'error' });
        } else {
          throw linkErr;
        }
        return;
      }

      setStatusMsg({ text: '¡Hijo vinculado con éxito!', type: 'success' });
      setEmailHijo('');
      fetchLinkedHijos();
    } catch (error) {
      console.error(error);
      setStatusMsg({ text: 'Error al vincular. Intenta más tarde.', type: 'error' });
    }
  };

  // Vincular Terapeuta al Hijo seleccionado
  const handleVincularTerapeuta = async (e) => {
    e.preventDefault();
    if (!emailTerapeuta || !selectedHijo) return;

    setStatusMsg({ text: 'Vinculando terapeuta...', type: 'info' });
    try {
      const { data: userRecord, error: userErr } = await supabase
        .from('usuarios')
        .select('id_usuario, rol')
        .eq('correo', emailTerapeuta.trim().toLowerCase())
        .single();

      if (userErr || !userRecord) {
        setStatusMsg({ text: 'No se encontró ningún terapeuta con ese correo.', type: 'error' });
        return;
      }

      if (userRecord.rol !== 'terapeuta') {
        setStatusMsg({ text: 'El usuario no tiene el rol de terapeuta.', type: 'error' });
        return;
      }

      const { error: linkErr } = await supabase
        .from('terapeutas_pacientes')
        .insert([{ id_terapeuta: userRecord.id_usuario, id_paciente: selectedHijo.id_paciente }]);

      if (linkErr) {
        if (linkErr.code === '23505') {
          setStatusMsg({ text: 'Este terapeuta ya está asignado a tu hijo.', type: 'error' });
        } else {
          throw linkErr;
        }
        return;
      }

      setStatusMsg({ text: '¡Terapeuta vinculado exitosamente!', type: 'success' });
      setEmailTerapeuta('');
      fetchHijoTerapeutas(selectedHijo.id_paciente);
    } catch (error) {
      console.error(error);
      setStatusMsg({ text: 'Error al vincular terapeuta.', type: 'error' });
    }
  };

  // Actualizar nivel de comunicación en Supabase
  const handleUpdateComunicacionLevel = async (hijoId, newLevel) => {
    try {
      const { error } = await supabase
        .from('pacientes')
        .update({ nivel_comunicacion: newLevel })
        .eq('id_paciente', hijoId);

      if (error) throw error;

      // Actualizar estado local
      setLinkedHijos(prev => prev.map(h => 
        h.id_paciente === hijoId ? { ...h, nivel_comunicacion: newLevel } : h
      ));

      if (selectedHijo?.id_paciente === hijoId) {
        setSelectedHijo(prev => ({ ...prev, nivel_comunicacion: newLevel }));
      }

      setStatusMsg({ text: 'Nivel de comunicación actualizado con éxito.', type: 'success' });
    } catch (error) {
      console.error('Error al actualizar nivel:', error);
      setStatusMsg({ text: 'Error al actualizar el nivel de comunicación.', type: 'error' });
    }
  };


  // Procesar Texto a Pictograma
  const handleTextToPictos = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setLoadingPictos(true);
    const words = inputText.trim().toLowerCase().split(/\s+/);
    const results = [];

    for (const word of words) {
      const cleanWord = word.replace(/[.,#!$%&;:{}=\-_~()¿?]/g, "").replace(/\//g, "").replace(/\*/g, "").replace(/\^/g, "");
      if (cleanWord) {
        const pictoRes = await searchPictograms(cleanWord);
        if (pictoRes.length > 0) {
          results.push(pictoRes[0]); // Tomar la primera coincidencia
        } else {
          // Si no hay pictograma oficial, crear uno de texto con categoría por defecto
          results.push({
            id: `text-${cleanWord}`,
            texto: cleanWord,
            imagen: '/placeholder-word.png', // Imagen de fallback de palabra escrita
            categoria: resolveCategory(cleanWord)
          });
        }
      }
    }

    setPhrasePictos(results);
    setLoadingPictos(false);
  };

  // Reproducir frase en voz alta (TTS)
  const handlePlayVoice = () => {
    if (phrasePictos.length === 0) return;
    const textToSpeak = phrasePictos.map(p => p.texto).join(' ');
    speakText(textToSpeak);
  };

  // Enviar frase de pictogramas al chat
  const handleSendPictosToChat = async () => {
    if (phrasePictos.length === 0 || !selectedHijo) return;

    const phraseStr = phrasePictos.map(p => p.texto).join(' ');
    const msgObj = {
      emisor_id: profile.id_usuario,
      receptor_id: selectedHijo.id_paciente,
      mensaje: phraseStr,
      tipo: 'pictograma'
    };

    if (isOffline) {
      const queued = await queueMessage(msgObj);
      if (queued) {
        setChatMessages(prev => [...prev, {
          ...queued,
          id_mensaje: queued.id_temp
        }]);
        setPhrasePictos([]);
        setInputText('');
        setStatusMsg({ text: 'Pictogramas guardados localmente (sin conexión).', type: 'info' });
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('mensajes')
        .insert([msgObj]);

      if (error) throw error;

      // Actualizar chat local
      fetchChatMessages(selectedHijo.id_paciente);
      setStatusMsg({ text: 'Pictogramas enviados al chat del hijo.', type: 'success' });
      setPhrasePictos([]);
      setInputText('');
    } catch (err) {
      console.error(err);
      const queued = await queueMessage(msgObj);
      if (queued) {
        setChatMessages(prev => [...prev, {
          ...queued,
          id_mensaje: queued.id_temp
        }]);
        setPhrasePictos([]);
        setInputText('');
        setStatusMsg({ text: 'Error de red. Pictogramas guardados localmente.', type: 'info' });
      }
    }
  };

  // Enviar mensaje de texto simple en Chat
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!newMsgText.trim() || !selectedHijo) return;

    const msgObj = {
      emisor_id: profile.id_usuario,
      receptor_id: selectedHijo.id_paciente,
      mensaje: newMsgText.trim(),
      tipo: 'texto'
    };

    if (isOffline) {
      const queued = await queueMessage(msgObj);
      if (queued) {
        setChatMessages(prev => [...prev, {
          ...queued,
          id_mensaje: queued.id_temp
        }]);
        setNewMsgText('');
        setStatusMsg({ text: 'Mensaje guardado localmente (sin conexión).', type: 'info' });
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('mensajes')
        .insert([msgObj])
        .select();

      if (error) throw error;

      setChatMessages(prev => [...prev, data[0]]);
      setNewMsgText('');
    } catch (err) {
      console.error(err);
      const queued = await queueMessage(msgObj);
      if (queued) {
        setChatMessages(prev => [...prev, {
          ...queued,
          id_mensaje: queued.id_temp
        }]);
        setNewMsgText('');
        setStatusMsg({ text: 'Error de red. Mensaje guardado localmente.', type: 'info' });
      }
    }
  };

  // Cargar una nueva nota al expediente
  const handleAddExpedienteNote = async (e) => {
    e.preventDefault();
    if (!nuevaNota.trim() || !selectedHijo) return;

    try {
      const { error } = await supabase
        .from('expedientes')
        .insert([{
          id_paciente: selectedHijo.id_paciente,
          id_terapeuta: null, // Subido por el padre
          diagnostico: 'Anotación del Padre/Tutor',
          notas: nuevaNota.trim(),
          avance: 'Reporte de comportamiento en casa'
        }]);

      if (error) throw error;

      setNuevaNota('');
      fetchExpedientes(selectedHijo.id_paciente);
      setStatusMsg({ text: 'Nota agregada al expediente clínico.', type: 'success' });
    } catch (err) {
      console.error(err);
      setStatusMsg({ text: 'Error al guardar la nota.', type: 'error' });
    }
  };

  return (
    <div style={styles.dashboardContainer}>
      {/* Sidebar de Navegación */}
      <div style={styles.sidebar}>
        <div style={styles.brandArea}>
          <img src="/dino-logo.png" alt="Dino" style={styles.sidebarLogo} />
          <h3>Panel Tutor</h3>
          <span style={styles.userEmail}>{profile.correo}</span>
        </div>

        <nav style={styles.nav}>
          <button 
            style={{...styles.navBtn, ...(activeTab === 'hijos' ? styles.navActive : {})}}
            onClick={() => setActiveTab('hijos')}
          >
            <Users size={20} /> Vincular Familia
          </button>
          <button 
            style={{...styles.navBtn, ...(activeTab === 'pictos' ? styles.navActive : {})}}
            onClick={() => setActiveTab('pictos')}
          >
            <Volume2 size={20} /> Creador Pictogramas
          </button>
          <button 
            style={{...styles.navBtn, ...(activeTab === 'chat' ? styles.navActive : {})}}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={20} /> Chat en Vivo
          </button>
          <button 
            style={{...styles.navBtn, ...(activeTab === 'expediente' ? styles.navActive : {})}}
            onClick={() => setActiveTab('expediente')}
          >
            <BookOpen size={20} /> Expediente
          </button>
        </nav>

        <button style={styles.logoutBtn} onClick={logout}>
          <LogOut size={20} /> Cerrar Sesión
        </button>
      </div>

      {/* Área Principal de Contenido */}
      <div style={styles.mainContent}>
        {showTestBanner && (
          <div id="dashboard-success-banner" style={styles.testBanner}>
            <div style={styles.testBannerContent}>
              <span style={{ fontSize: '1.4rem' }}>🎉</span>
              <div style={{ textAlign: 'left' }}>
                <strong>¡Prueba de Autenticación Exitosa!</strong>
                <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                  Se inició sesión correctamente y se cargó el Dashboard para el rol de PADRE/TUTOR.
                </div>
              </div>
              <button onClick={() => setShowTestBanner(false)} style={styles.testBannerClose}>&times;</button>
            </div>
          </div>
        )}

        {isOffline && (
          <div style={styles.offlineBanner}>
            <WifiOff size={18} /> Estás sin conexión. Algunas funciones se guardarán localmente.
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

        {/* CONTENIDO DE PESTAÑA: VINCULAR FAMILIA */}
        {activeTab === 'hijos' && (
          <div style={styles.tabSection}>
            <h2 style={styles.sectionHeading}>Gestión de Familia y Vinculaciones</h2>
            <p style={styles.sectionSub}>Asocia las cuentas de tus hijos (pacientes TEA) y sus respectivos terapeutas.</p>

            <div style={styles.twoColumnGrid}>
              {/* Columna Vinculación */}
              <div className="card">
                <h3 style={{ marginBottom: 16 }}>Vincular Paciente (Hijo/a)</h3>
                <form onSubmit={handleVincularHijo} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="hijo-email-v">Correo del Paciente Registrado</label>
                    <input
                      id="hijo-email-v"
                      className="form-input"
                      type="email"
                      placeholder="correo.hijo@ejemplo.com"
                      value={emailHijo}
                      onChange={(e) => setEmailHijo(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    <Plus size={20} /> Vincular Paciente
                  </button>
                </form>

                {selectedHijo && (
                  <div style={styles.linkTherapistArea}>
                    <h3 style={{ marginBottom: 16, marginTop: 24 }}>Asignar Terapeuta a {selectedHijo.correo}</h3>
                    <form onSubmit={handleVincularTerapeuta} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div className="form-group">
                        <label className="form-label" htmlFor="terapeuta-email-v">Correo del Terapeuta Registrado</label>
                        <input
                          id="terapeuta-email-v"
                          className="form-input"
                          type="email"
                          placeholder="terapeuta@ejemplo.com"
                          value={emailTerapeuta}
                          onChange={(e) => setEmailTerapeuta(e.target.value)}
                          required
                        />
                      </div>
                      <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>
                        <Plus size={20} /> Vincular Terapeuta
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Columna Listado */}
              <div className="card">
                <h3 style={{ marginBottom: 16 }}>Pacientes Vinculados ({linkedHijos.length})</h3>
                {linkedHijos.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)' }}>Aún no tienes hijos vinculados a tu perfil.</p>
                ) : (
                  <div style={styles.hijosList}>
                    {linkedHijos.map(hijo => (
                      <div 
                        key={hijo.id_paciente}
                        style={{
                          ...styles.hijoItem,
                          border: selectedHijo?.id_paciente === hijo.id_paciente ? '3px solid var(--color-brand)' : '1px solid var(--color-border)'
                        }}
                        onClick={() => setSelectedHijo(hijo)}
                      >
                        <div style={styles.hijoIconWrapper}>
                          <User size={24} color="var(--color-brand)" />
                        </div>
                        <div style={{ flexGrow: 1, textAlign: 'left' }}>
                          <h4 style={{ fontSize: '1.1rem' }}>{hijo.correo}</h4>
                          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={styles.badge}>Rango: {hijo.etapa_vida} años</span>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-text-muted)' }}>Nivel:</label>
                              <select
                                value={hijo.nivel_comunicacion}
                                onChange={(e) => handleUpdateComunicacionLevel(hijo.id_paciente, e.target.value)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--color-border)',
                                  fontSize: '0.85rem',
                                  fontWeight: 'bold',
                                  backgroundColor: '#e0e7ff',
                                  color: '#4338ca',
                                  cursor: 'pointer',
                                  outline: 'none'
                                }}
                              >
                                <option value="Básico">Básico</option>
                                <option value="Intermedio">Intermedio</option>
                                <option value="Avanzado">Avanzado</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedHijo && (
                  <div style={{ marginTop: 24, borderTop: '2px solid var(--color-border)', paddingTop: 16 }}>
                    <h4 style={{ textAlign: 'left', marginBottom: 12 }}>Terapeutas de {selectedHijo.correo}:</h4>
                    {hijoTerapeutas.length === 0 ? (
                      <p style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                        No hay terapeutas asignados a este paciente.
                      </p>
                    ) : (
                      <div style={styles.terapeutasList}>
                        {hijoTerapeutas.map(ter => (
                          <div key={ter.id_terapeuta} style={styles.terapeutaItem}>
                            <p style={{ fontWeight: 'bold', margin: 0 }}>{ter.correo}</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
                              {ter.especialidad} | Cédula: {ter.cedula}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CONTENIDO DE PESTAÑA: CREADOR PICTOGRAMAS */}
        {activeTab === 'pictos' && (
          <div style={styles.tabSection}>
            <h2 style={styles.sectionHeading}>Traductor de Texto a Pictogramas</h2>
            <p style={styles.sectionSub}>Escribe una frase y se traducirá a pictogramas para facilitar la explicación visual.</p>

            <div className="card" style={{ marginBottom: 24 }}>
              <form onSubmit={handleTextToPictos} style={styles.pictoForm}>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Ej: papá quiere jugar pelota..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  style={{ flexGrow: 1 }}
                />
                <button type="submit" className="btn btn-primary" disabled={loadingPictos}>
                  {loadingPictos ? 'Procesando...' : 'Traducir'}
                </button>
              </form>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 16, textAlign: 'left' }}>Secuencia Visual</h3>
              
              <div className="phrase-bar">
                {phrasePictos.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', margin: 'auto' }}>
                    Los pictogramas aparecerán aquí cuando traduzcas una frase.
                  </p>
                ) : (
                  phrasePictos.map((pic, idx) => (
                    <div 
                      key={`${pic.id}-${idx}`} 
                      className={`phrase-item pic-${pic.categoria}`}
                    >
                      <img src={pic.imagen} alt={pic.texto} onError={(e) => e.target.src = '/placeholder-word.png'} />
                      <span>{pic.texto}</span>
                      <button 
                        className="btn-remove"
                        onClick={() => setPhrasePictos(prev => prev.filter((_, i) => i !== idx))}
                      >
                        x
                      </button>
                    </div>
                  ))
                )}
              </div>

              {phrasePictos.length > 0 && (
                <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={handlePlayVoice}>
                    <Volume2 size={20} /> Escuchar Audio
                  </button>
                  {selectedHijo && (
                    <button className="btn btn-primary" onClick={handleSendPictosToChat}>
                      <Send size={20} /> Enviar al hijo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONTENIDO DE PESTAÑA: CHAT */}
        {activeTab === 'chat' && (
          <div style={styles.tabSection}>
            <h2 style={styles.sectionHeading}>Chat en Tiempo Real</h2>
            {!selectedHijo ? (
              <div className="card" style={{ padding: 32 }}>
                <p>Por favor vincula y selecciona un paciente en la pestaña "Vincular Familia" para chatear.</p>
              </div>
            ) : (
              <div className="card" style={styles.chatCard}>
                <div style={styles.chatHeader}>
                  <div style={styles.chatHeaderInfo}>
                    <User size={24} />
                    <strong>Chateando con: {selectedHijo.correo}</strong>
                  </div>
                  <span style={styles.badge}>Paciente Activo</span>
                </div>

                <div style={styles.chatBody}>
                  <div className="chat-messages">
                    {chatMessages.length === 0 ? (
                      <p style={{ color: 'var(--color-text-muted)', margin: 'auto' }}>
                        No hay mensajes anteriores. ¡Escribe un mensaje para empezar!
                      </p>
                    ) : (
                      chatMessages.map((msg) => (
                        <div 
                          key={msg.id_mensaje}
                          className={`chat-bubble ${msg.emisor_id === profile.id_usuario ? 'bubble-sent' : 'bubble-received'}`}
                        >
                          {msg.tipo === 'pictograma' ? (
                            <div style={styles.chatPictoContainer}>
                              <p style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: 4 }}>Frase visual:</p>
                              <strong style={{ textTransform: 'uppercase', fontSize: '1.2rem', display: 'block', marginBottom: 8 }}>
                                {msg.mensaje}
                              </strong>
                              {/* Renderizar miniatura del primer pictograma */}
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {msg.mensaje.split(' ').map((word, i) => (
                                  <div key={i} style={styles.chatPictoTag}>
                                    {word}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div>{msg.mensaje}</div>
                          )}
                          <span style={styles.chatTime}>
                            {new Date(msg.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </div>

                <form onSubmit={handleSendChatMessage} style={styles.chatInputArea}>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Escribe un mensaje al paciente..."
                    value={newMsgText}
                    onChange={(e) => setNewMsgText(e.target.value)}
                    style={{ flexGrow: 1 }}
                  />
                  <button type="submit" className="btn btn-primary" style={styles.chatSendBtn}>
                    <Send size={20} />
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* CONTENIDO DE PESTAÑA: EXPEDIENTE */}
        {activeTab === 'expediente' && (
          <div style={styles.tabSection}>
            <h2 style={styles.sectionHeading}>Expediente Clínico y Avances</h2>
            {!selectedHijo ? (
              <div className="card">
                <p>Vincula y selecciona un paciente en la pestaña "Vincular Familia" para consultar el expediente.</p>
              </div>
            ) : (
              <div style={styles.twoColumnGrid}>
                {/* Agregar anotación del padre */}
                <div className="card">
                  <h3 style={{ marginBottom: 16 }}>Agregar Nota sobre el Paciente</h3>
                  <form onSubmit={handleAddExpedienteNote} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="padre-nota-txt">Comportamiento, dudas o novedades clínicas</label>
                      <textarea
                        id="padre-nota-txt"
                        className="form-input"
                        placeholder="Ej: Hoy el paciente estuvo calmado. Comió plátano y manzana sin problemas..."
                        value={nuevaNota}
                        onChange={(e) => setNuevaNota(e.target.value)}
                        style={{ minHeight: '120px', resize: 'none' }}
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-primary">
                      Guardar Anotación
                    </button>
                  </form>
                </div>

                {/* Historial de Expedientes */}
                <div className="card">
                  <h3 style={{ marginBottom: 16 }}>Historial de Diagnósticos y Notas</h3>
                  {expedientes.length === 0 ? (
                    <p style={{ color: 'var(--color-text-muted)' }}>No hay reportes clínicos registrados para este paciente.</p>
                  ) : (
                    <div style={styles.expedientesList}>
                      {expedientes.map(exp => (
                        <div key={exp.id_expediente} style={styles.expedienteCard}>
                          <div style={styles.expedienteHeader}>
                            <FileText size={18} color="var(--color-brand)" />
                            <strong>{exp.diagnostico || 'Nota General'}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                              {new Date(exp.fecha_actualizacion).toLocaleDateString()}
                            </span>
                          </div>
                          <div style={styles.expedienteBody}>
                            <p style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>{exp.notas}</p>
                            {exp.avance && (
                              <p style={{ fontSize: '0.9rem', color: 'var(--color-brand)', fontWeight: 'bold', margin: 0 }}>
                                ✓ Avance: {exp.avance}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
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
    width: '280px',
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
    marginBottom: '32px',
    borderBottom: '2px solid var(--color-border)',
    paddingBottom: '16px'
  },
  sidebarLogo: {
    width: '70px',
    height: '70px',
    objectFit: 'contain',
    marginBottom: '8px'
  },
  userEmail: {
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
    marginTop: '4px',
    fontWeight: '600'
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flexGrow: 1
  },
  navBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-main)',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '700',
    minHeight: '48px',
    transition: 'var(--transition-smooth)'
  },
  navActive: {
    backgroundColor: 'var(--color-brand-light)',
    color: 'var(--color-brand)'
  },
  logoutBtn: {
    backgroundColor: '#fef2f2',
    color: 'var(--color-panic)',
    border: '1px solid #fee2e2',
    marginTop: 'auto',
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
  tabSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    animation: 'fadeIn 0.4s ease-out'
  },
  sectionHeading: {
    fontSize: '2rem',
    textAlign: 'left'
  },
  sectionSub: {
    color: 'var(--color-text-muted)',
    textAlign: 'left',
    fontSize: '1.1rem',
    marginTop: '-12px',
    fontWeight: '500'
  },
  twoColumnGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr',
    gap: '24px',
    alignItems: 'start'
  },
  badge: {
    display: 'inline-block',
    fontSize: '0.8rem',
    backgroundColor: 'var(--color-brand-light)',
    color: 'var(--color-brand)',
    padding: '4px 10px',
    borderRadius: '20px',
    fontWeight: 'bold',
    marginRight: '8px',
    marginTop: '6px'
  },
  hijosList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '12px'
  },
  hijoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px',
    borderRadius: '16px',
    cursor: 'pointer',
    backgroundColor: '#fafbfd',
    transition: 'var(--transition-smooth)'
  },
  hijoIconWrapper: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    backgroundColor: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-sm)'
  },
  linkTherapistArea: {
    borderTop: '2px solid var(--color-border)',
    marginTop: '20px',
    paddingTop: '10px'
  },
  terapeutasList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '10px'
  },
  terapeutaItem: {
    padding: '12px',
    borderRadius: '12px',
    backgroundColor: '#fafbfd',
    border: '1px solid var(--color-border)',
    textAlign: 'left'
  },
  pictoForm: {
    display: 'flex',
    gap: '12px'
  },
  chatCard: {
    height: '600px',
    display: 'flex',
    flexDirection: 'column',
    padding: 0
  },
  chatHeader: {
    padding: '16px 24px',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  chatHeaderInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  chatBody: {
    flexGrow: 1,
    overflowY: 'auto',
    backgroundColor: '#f8fafc'
  },
  chatInputArea: {
    padding: '16px',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    gap: '12px',
    backgroundColor: 'white',
    borderRadius: '0 0 var(--radius-lg) var(--radius-lg)'
  },
  chatSendBtn: {
    padding: '0 24px'
  },
  chatTime: {
    display: 'block',
    fontSize: '0.75rem',
    textAlign: 'right',
    opacity: 0.8,
    marginTop: '4px'
  },
  chatPictoContainer: {
    textAlign: 'left'
  },
  chatPictoTag: {
    display: 'inline-block',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    padding: '2px 8px',
    borderRadius: '6px',
    textTransform: 'uppercase'
  },
  expedientesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  expedienteCard: {
    padding: '16px',
    border: '1px solid var(--color-border)',
    borderRadius: '16px',
    backgroundColor: '#fafbfd',
    textAlign: 'left'
  },
  expedienteHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
    borderBottom: '1px solid var(--color-border)',
    paddingBottom: '8px'
  },
  expedienteBody: {
    fontSize: '0.95rem'
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
