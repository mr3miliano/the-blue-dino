import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import { supabase } from '../../services/supabase';
import { searchPictograms, resolveCategory } from '../../services/arasaac';
import { speakText, SpeechToTextSession } from '../../services/googleVoice';
import { queuePanicAlert, queueMessage } from '../../services/offlineSync';
import { sendPanicNotification } from '../../services/firebase';
import { 
  Volume2, Mic, AlertCircle, Send, MessageCircle, 
  Shield, Trash2, WifiOff, Settings
} from 'lucide-react';

// Vocabulario por Etapas de Vida
const VOCABULARY_BY_STAGE = {
  '6-12': {
    categories: ['personas', 'acciones', 'cosas', 'comida'],
    items: {
      personas: ['yo', 'tú', 'papá', 'mamá', 'abuelo', 'abuela', 'hermano', 'hermana'],
      acciones: ['querer', 'jugar', 'comer', 'dormir', 'ir', 'hacer', 'bañarse'],
      cosas: ['juguete', 'baño', 'casa', 'parque', 'vaso', 'plato', 'tv', 'pelota'],
      comida: ['pan', 'manzana', 'plátano', 'leche', 'galleta']
    }
  },
  '13-18': {
    categories: ['social', 'gustos', 'emociones'],
    items: {
      social: ['hola', 'adiós', 'gracias', 'por favor', 'amigo', 'amiga', 'escuela', 'ayuda'],
      gustos: ['música', 'videojuegos', 'película', 'dibujar', 'leer', 'pasear', 'deporte'],
      emociones: ['feliz', 'triste', 'enojado', 'cansado', 'asustado', 'tranquilo']
    }
  },
  '18-25': {
    categories: ['independencia', 'tareas', 'trabajo_estudio'],
    items: {
      independencia: ['dinero', 'tienda', 'autobús', 'mapa', 'llaves', 'celular', 'médico'],
      tareas: ['limpiar', 'lavar', 'cocinar', 'ordenar', 'comprar', 'despertar'],
      trabajo_estudio: ['clase', 'oficina', 'computadora', 'horario', 'descanso', 'tarea']
    }
  }
};

// Tarjetas de Inicio (Starter Cards) para Nivel Intermedio
const STARTERS = [
  { text: 'Yo quiero', term: 'querer', icon: '👉', category: 'acciones' },
  { text: 'Yo tengo', term: 'tener', icon: '🙌', category: 'cosas' },
  { text: 'Yo siento', term: 'sentir', icon: '❤️', category: 'emociones' },
  { text: 'Me duele', term: 'dolor', icon: '🩹', category: 'síntomas' },
  { text: 'Vamos a', term: 'ir', icon: '🚶', category: 'cosas' },
  { text: '¿Puedo?', term: 'poder', icon: '❓', category: 'acciones' }
];

// Plantillas de Independencia Diaria para Nivel Avanzado
const ADVANCED_TEMPLATES = {
  transporte: [
    { text: '¿Este autobús va a [Destino]?', label: '¿Este autobús va a...?', hasInput: true, placeholder: 'ej. Centro, Escuela, Hospital' },
    { text: 'Un boleto, por favor.', label: 'Pedir un boleto de pasaje' },
    { text: '¿Dónde está la parada de autobús?', label: 'Buscar parada de autobús' },
    { text: '¿Cuánto cuesta el pasaje?', label: 'Preguntar precio del viaje' }
  ],
  compras: [
    { text: '¿Cuánto cuesta esto, por favor?', label: 'Preguntar precio' },
    { text: 'Quiero pagar con tarjeta.', label: 'Pagar con tarjeta bancaria' },
    { text: 'Quiero pagar con efectivo.', label: 'Pagar con billetes/monedas' },
    { text: '¿Me da una bolsa, por favor?', label: 'Pedir bolsa para comprar' },
    { text: '¿Dónde puedo encontrar [Artículo]?', label: 'Buscar un artículo', hasInput: true, placeholder: 'ej. leche, agua, comida' }
  ],
  restaurante: [
    { text: 'Quiero ordenar la comida, por favor.', label: 'Ordenar comida de la mesa' },
    { text: 'La cuenta, por favor.', label: 'Pedir la cuenta para pagar' },
    { text: '¿Tienen una mesa libre?', label: 'Preguntar por mesa libre' },
    { text: 'Muchas gracias por la comida.', label: 'Dar las gracias' }
  ],
  emergencias: [
    { text: 'Necesito ayuda médica, por favor.', label: 'Ayuda médica urgente', isPanic: true },
    { text: 'Estoy perdido. Por favor llame a mi tutor.', label: 'Estoy perdido / extraviado', isPanic: true },
    { text: 'Por favor, ayúdeme, no me siento bien.', label: 'No me siento bien / dolor', isPanic: true }
  ]
};

export default function PacienteDashboard() {
  const [showTestBanner, setShowTestBanner] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowTestBanner(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Etapa de vida del paciente (default 6-12)
  const etapa = profile?.etapa_vida || '6-12';
  const vocData = VOCABULARY_BY_STAGE[etapa];
  
  // Nivel de comunicación
  const [comunicacionLevel, setComunicacionLevel] = useState('Básico');
  const [selectedCategory, setSelectedCategory] = useState(vocData.categories[0]);
  const [loadedPictos, setLoadedPictos] = useState({}); // caché de carga rápida de pictogramas
  const [loadingPictos, setLoadingPictos] = useState(false);
  
  // Frase visual seleccionada (Básico/Intermedio)
  const [phrase, setPhrase] = useState([]);
  
  // Control de Botón de Pánico
  const [panicOverlay, setPanicOverlay] = useState(false);
  const [panicCountdown, setPanicCountdown] = useState(3);
  const [panicStatus, setPanicStatus] = useState(''); // 'counting', 'triggered', 'error'
  const countdownIntervalRef = useRef(null);

  // Chat en tiempo real con padres vinculados
  const [padreVinculado, setPadreVinculado] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMsgText, setNewMsgText] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const chatEndRef = useRef(null);

  // Grabación de voz (STT)
  const [isRecording, setIsRecording] = useState(false);
  const [sttSession, setSttSession] = useState(null);

  // Estados para Entrada Avanzada de Texto y Autocompletado
  const [advancedText, setAdvancedText] = useState('');
  const [advancedPictos, setAdvancedPictos] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedTemplateTab, setSelectedTemplateTab] = useState('transporte');
  const [templateInputs, setTemplateInputs] = useState({});

  // ----------------------------------------------------
  // ESTADOS NUEVOS PARA PERSONALIZACIÓN DE INTERFAZ
  // ----------------------------------------------------
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [interfaceConfig, setInterfaceConfig] = useState({
    showStarters: false,      // Tarjetas de inicio
    showStepGuide: false,     // Indicador de pasos
    showPictoGrid: true,      // Grilla de categorías
    showTextInput: false,     // Entrada de teclado libre
    showSuggestions: false,   // Sugerencias predictivas de pictogramas
    showTemplates: false,     // Plantillas de autonomía
    showVoiceSTT: true        // Micrófono
  });
  
  // Modo actual de la barra lateral ('tablero' o 'plantillas')
  const [sidebarMode, setSidebarMode] = useState('tablero');

  const categories = useMemo(() => {
    const cats = [...vocData.categories];
    if (comunicacionLevel === 'Intermedio' || interfaceConfig.showStarters) {
      if (!cats.includes('síntomas')) cats.push('síntomas');
      if (!cats.includes('emociones')) cats.push('emociones');
    }
    return cats;
  }, [vocData.categories, comunicacionLevel, interfaceConfig.showStarters]);

  const items = useMemo(() => {
    const its = { ...vocData.items };
    if (comunicacionLevel === 'Intermedio' || interfaceConfig.showStarters) {
      its.síntomas = ['cabeza', 'estómago', 'dientes', 'garganta', 'pie', 'mano', 'ojo', 'oído'];
      its.emociones = ['feliz', 'triste', 'enojado', 'cansado', 'asustado', 'tranquilo'];
    }
    return its;
  }, [vocData.items, comunicacionLevel, interfaceConfig.showStarters]);

  const loadedPictosRef = useRef(loadedPictos);
  useEffect(() => {
    loadedPictosRef.current = loadedPictos;
  }, [loadedPictos]);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const fetchPadreVinculado = useCallback(async () => {
    if (!profile?.id_usuario) return;
    try {
      const { data, error } = await supabase
        .from('padres_pacientes')
        .select(`
          id_padre,
          padres (
            usuarios (
              correo
            )
          )
        `)
        .eq('id_paciente', profile.id_usuario)
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) {
        setPadreVinculado({
          id_padre: data[0].id_padre,
          correo: data[0].padres.usuarios.correo
        });
      }
    } catch (error) {
      console.error('Error al buscar padre:', error);
    }
  }, [profile]);

  const fetchChatMessages = useCallback(async (padreId) => {
    if (!profile?.id_usuario) return;
    try {
      const { data, error } = await supabase
        .from('mensajes')
        .select('*')
        .or(`and(emisor_id.eq.${profile.id_usuario},receptor_id.eq.${padreId}),and(emisor_id.eq.${padreId},receptor_id.eq.${profile.id_usuario})`)
        .order('fecha', { ascending: true });

      if (error) throw error;
      setChatMessages(data || []);
    } catch (error) {
      console.error('Error al cargar mensajes de chat:', error);
    }
  }, [profile]);

  const loadCategoryPictograms = useCallback(async (cat) => {
    setLoadingPictos(true);
    const terms = items[cat] || [];
    const newPictos = { ...loadedPictos };

    for (const term of terms) {
      if (!newPictos[term]) {
        const results = await searchPictograms(term);
        if (results.length > 0) {
          newPictos[term] = results[0];
        } else {
          newPictos[term] = {
            id: `local-${term}`,
            texto: term,
            imagen: '/placeholder-word.png',
            categoria: resolveCategory(term)
          };
        }
      }
    }

    setLoadedPictos(newPictos);
    setLoadingPictos(false);
  }, [items, loadedPictos]);

  // Aplicar configuración por defecto del nivel
  const applyLevelConfig = (level) => {
    if (level === 'Básico') {
      setInterfaceConfig({
        showStarters: false,
        showStepGuide: false,
        showPictoGrid: true,
        showTextInput: false,
        showSuggestions: false,
        showTemplates: false,
        showVoiceSTT: true
      });
    } else if (level === 'Intermedio') {
      setInterfaceConfig({
        showStarters: true,
        showStepGuide: true,
        showPictoGrid: true,
        showTextInput: false,
        showSuggestions: false,
        showTemplates: false,
        showVoiceSTT: true
      });
    } else if (level === 'Avanzado') {
      setInterfaceConfig({
        showStarters: false,
        showStepGuide: false,
        showPictoGrid: false, // Por defecto oculto, pero activable para modo híbrido
        showTextInput: true,
        showSuggestions: true,
        showTemplates: true,
        showVoiceSTT: true
      });
    }
  };

  // Sincronizar nivel con perfil al cargar o asignar por defecto según etapa de vida
  useEffect(() => {
    if (profile?.nivel_comunicacion) {
      const level = profile.nivel_comunicacion;
      setTimeout(() => setComunicacionLevel(level), 0);
    } else if (profile?.etapa_vida) {
      // Asignar nivel recomendado adaptado a la etapa de vida
      if (profile.etapa_vida === '18-25') {
        setTimeout(() => setComunicacionLevel('Avanzado'), 0);
      } else if (profile.etapa_vida === '13-18') {
        setTimeout(() => setComunicacionLevel('Intermedio'), 0);
      } else {
        setTimeout(() => setComunicacionLevel('Básico'), 0);
      }
    }
  }, [profile?.nivel_comunicacion, profile?.etapa_vida]);

  // Aplicar cambios en la plantilla base de nivel
  useEffect(() => {
    setTimeout(() => applyLevelConfig(comunicacionLevel), 0);
  }, [comunicacionLevel]);

  // Sincronizar el modo de sidebar activo si cambian las banderas
  useEffect(() => {
    if (interfaceConfig.showPictoGrid) {
      setTimeout(() => setSidebarMode('tablero'), 0);
    } else if (interfaceConfig.showTemplates) {
      setTimeout(() => setSidebarMode('plantillas'), 0);
    }
  }, [interfaceConfig.showPictoGrid, interfaceConfig.showTemplates]);



  // Cambiar selectedCategory si no existe en la lista actual
  useEffect(() => {
    if (!categories.includes(selectedCategory)) {
      const firstCat = categories[0];
      setTimeout(() => setSelectedCategory(firstCat), 0);
    }
  }, [categories, selectedCategory]);

  // Cargar pictogramas de la categoría seleccionada
  useEffect(() => {
    if (interfaceConfig.showPictoGrid) {
      Promise.resolve().then(() => {
        loadCategoryPictograms(selectedCategory);
      });
    }
  }, [selectedCategory, etapa, comunicacionLevel, interfaceConfig.showPictoGrid, loadCategoryPictograms]);

  // Buscar al padre vinculado y cargar chat
  useEffect(() => {
    if (profile) {
      Promise.resolve().then(() => {
        fetchPadreVinculado();
      });
    } else {
      setTimeout(() => {
        setPadreVinculado(null);
        setChatMessages([]);
      }, 0);
    }
  }, [profile, fetchPadreVinculado]);

  useEffect(() => {
    if (padreVinculado) {
      Promise.resolve().then(() => {
        fetchChatMessages(padreVinculado.id_padre);
      });

      const channel = supabase
        .channel(`chat_hijo_${profile.id_usuario}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'mensajes',
            filter: `emisor_id=eq.${padreVinculado.id_padre}`,
          },
          (payload) => {
            console.log('[Realtime] Nuevo mensaje del padre recibido:', payload.new);
            setChatMessages(prev => [...prev, payload.new]);
            speakText(`Papá dice: ${payload.new.mensaje}`);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [padreVinculado, profile?.id_usuario, fetchChatMessages]);

  // Pre-cargar términos comunes
  useEffect(() => {
    const preloadExtraTerms = async () => {
      const extraTerms = [
        'querer', 'tener', 'sentir', 'dolor', 'ir', 'poder',
        'cabeza', 'estómago', 'dientes', 'garganta', 'pie', 'mano', 'ojo', 'oído',
        'autobús', 'tienda', 'dinero', 'comprar', 'ayuda', 'médico', 'feliz', 'triste', 'enojado'
      ];
      const newPictos = {};
      for (const term of extraTerms) {
        const results = await searchPictograms(term);
        if (results.length > 0) {
          newPictos[term] = results[0];
        }
      }
      if (Object.keys(newPictos).length > 0) {
        setLoadedPictos(prev => ({ ...newPictos, ...prev }));
      }
    };
    preloadExtraTerms();
  }, []);

  // Auto-scroll del chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Debounce para la traducción a pictogramas en tiempo real (Nivel Avanzado / Modo Teclado)
  useEffect(() => {
    if (!interfaceConfig.showTextInput) return;
    
    const timer = setTimeout(async () => {
      if (!advancedText.trim()) {
        setAdvancedPictos([]);
        return;
      }
      
      const words = advancedText.toLowerCase().split(/\s+/).filter(Boolean);
      const mapped = [];
      
      for (const w of words) {
        const clean = w.replace(/[.,#!$%&;:{}=\-_~()¿?]/g, "").replace(/\//g, "").replace(/\*/g, "").replace(/\^/g, "");
        if (clean) {
          if (loadedPictosRef.current[clean]) {
            mapped.push(loadedPictosRef.current[clean]);
          } else {
            const results = await searchPictograms(clean);
            if (results.length > 0) {
              setLoadedPictos(prev => ({ ...prev, [clean]: results[0] }));
              mapped.push(results[0]);
            }
          }
        }
      }
      setAdvancedPictos(mapped);
    }, 450);
    
    return () => clearTimeout(timer);
  }, [advancedText, interfaceConfig.showTextInput]);

  // Sugerencias predictivas
  useEffect(() => {
    if (!interfaceConfig.showTextInput || !interfaceConfig.showSuggestions) return;
    
    const words = advancedText.toLowerCase().split(/\s+/);
    const lastWord = words[words.length - 1]?.trim();
    
    if (!lastWord || lastWord.length < 2) {
      setTimeout(() => setSuggestions([]), 0);
      return;
    }
    
    const timer = setTimeout(async () => {
      const allKnownTerms = [
        ...Object.keys(loadedPictosRef.current),
        ...Object.values(itemsRef.current).flat(),
        'comer', 'jugar', 'dormir', 'quiero', 'baño', 'casa', 'parque', 'agua', 'jugo', 'comida',
        'autobús', 'tienda', 'dinero', 'comprar', 'computadora', 'medicina', 'ayuda', 'médico'
      ];
      
      const uniqueKnownTerms = [...new Set(allKnownTerms)];
      const localMatches = uniqueKnownTerms.filter(t => t.startsWith(lastWord) && t !== lastWord).slice(0, 5);
      
      const suggestionCards = [];
      for (const term of localMatches) {
        if (loadedPictosRef.current[term]) {
          suggestionCards.push(loadedPictosRef.current[term]);
        } else {
          const res = await searchPictograms(term);
          if (res.length > 0) {
            suggestionCards.push(res[0]);
            setLoadedPictos(prev => ({ ...prev, [term]: res[0] }));
          }
        }
      }
      
      if (suggestionCards.length < 3 && navigator.onLine) {
        try {
          const apiResults = await searchPictograms(lastWord);
          for (const item of apiResults) {
            if (suggestionCards.length >= 6) break;
            if (!suggestionCards.some(s => s.texto === item.texto)) {
              suggestionCards.push(item);
              setLoadedPictos(prev => ({ ...prev, [item.texto]: item }));
            }
          }
        } catch (err) {
          console.error(err);
        }
      }
      
      setSuggestions(suggestionCards);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [advancedText, interfaceConfig.showTextInput, interfaceConfig.showSuggestions]);



  // Conjugador Gramatical
  const conjugatePhrase = (phraseItems) => {
    if (phraseItems.length === 0) return "";
    
    let words = [];
    for (let i = 0; i < phraseItems.length; i++) {
      const item = phraseItems[i];
      const text = item.texto.toLowerCase().trim();
      
      if (i === 0) {
        words.push(item.texto);
        continue;
      }
      
      const prevText = phraseItems[i - 1].texto.toLowerCase().trim();
      
      if (prevText === 'yo quiero') {
        if (text === 'pan') words.push('un pan');
        else if (text === 'manzana') words.push('una manzana');
        else if (text === 'plátano') words.push('un plátano');
        else if (text === 'leche') words.push('leche');
        else if (text === 'galleta') words.push('una galleta');
        else if (text === 'juguete') words.push('un juguete');
        else if (text === 'baño') words.push('ir al baño');
        else if (text === 'agua') words.push('agua');
        else if (text === 'jugo') words.push('jugo');
        else if (text === 'pelota') words.push('una pelota');
        else words.push(text);
      } else if (prevText === 'yo tengo') {
        if (text === 'pan') words.push('pan');
        else if (text === 'juguete') words.push('un juguete');
        else if (text === 'pelota') words.push('una pelota');
        else if (['sueño', 'hambre', 'frío', 'calor', 'sueño', 'miedo'].includes(text)) words.push(text);
        else words.push(text);
      } else if (prevText === 'me duele') {
        const femeninos = ['cabeza', 'garganta', 'mano', 'espalda', 'barriga', 'pierna', 'rodilla'];
        const masculinos = ['estómago', 'pie', 'ojo', 'oído', 'diente'];
        if (femeninos.includes(text)) {
          words.push(`la ${text}`);
        } else if (masculinos.includes(text)) {
          words.push(`el ${text}`);
        } else if (text === 'dientes') {
          words.push('los dientes');
        } else {
          words.push(text);
        }
      } else if (prevText === 'vamos a') {
        if (text === 'parque') words.push('al parque');
        else if (text === 'baño') words.push('al baño');
        else if (text === 'casa') words.push('a casa');
        else if (text === 'tienda') words.push('a la tienda');
        else if (text === 'escuela') words.push('a la escuela');
        else words.push(text);
      } else if (prevText === 'yo siento') {
        if (text === 'feliz') words.push('alegría');
        else if (text === 'triste') words.push('tristeza');
        else if (text === 'enojado') words.push('enojo');
        else if (text === 'cansado') words.push('cansancio');
        else words.push(text);
      } else {
        words.push(text);
      }
    }
    
    const sentence = words.join(' ');
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  };

  // Agregar pictograma (Híbrido)
  const handleAddPicto = (picto) => {
    if (interfaceConfig.showTextInput) {
      // Si el teclado está visible, agregamos el texto directamente al input
      setAdvancedText(prev => prev ? `${prev.trim()} ${picto.texto} ` : `${picto.texto} `);
    } else {
      // De lo contrario, se comporta como fichas tradicionales
      setPhrase(prev => [...prev, picto]);
    }
    speakText(picto.texto);
  };

  // Seleccionar tarjeta de inicio (Híbrido)
  const handleSelectStarter = (starter) => {
    if (interfaceConfig.showTextInput) {
      setAdvancedText(`${starter.text} `);
    } else {
      const pic = loadedPictos[starter.term] || {
        id: `starter-${starter.term}`,
        texto: starter.text,
        imagen: '/placeholder-word.png',
        categoria: 'personas'
      };
      const starterPic = { ...pic, texto: starter.text, categoria: 'personas' };
      setPhrase([starterPic]);
    }
    speakText(starter.text);
    if (starter.category) {
      setSelectedCategory(starter.category);
    }
  };

  // Quitar pictograma de la frase
  const handleRemovePicto = (idx) => {
    setPhrase(prev => prev.filter((_, i) => i !== idx));
  };

  // Reproducir frase armada (TTS)
  const handlePlayPhrase = () => {
    if (phrase.length === 0) return;
    const sentence = comunicacionLevel === 'Intermedio' || interfaceConfig.showStarters 
      ? conjugatePhrase(phrase) 
      : phrase.map(p => p.texto).join(' ');
    speakText(sentence);
  };

  // Enviar frase al chat
  const handleSendPhraseToChat = async () => {
    if (phrase.length === 0 || !padreVinculado) return;

    const sentence = comunicacionLevel === 'Intermedio' || interfaceConfig.showStarters
      ? conjugatePhrase(phrase)
      : phrase.map(p => p.texto).join(' ');

    const msgData = {
      emisor_id: profile.id_usuario,
      receptor_id: padreVinculado.id_padre,
      mensaje: sentence,
      tipo: 'pictograma'
    };

    try {
      if (isOffline) {
        const localMsg = await queueMessage(msgData);
        if (localMsg) setChatMessages(prev => [...prev, localMsg]);
      } else {
        const { data, error } = await supabase.from('mensajes').insert([msgData]).select();
        if (error) throw error;
        setChatMessages(prev => [...prev, data[0]]);
      }
      setPhrase([]);
    } catch (error) {
      console.error('Error al enviar frase:', error);
    }
  };

  // Autocompletado (Avanzado)
  const handleSelectSuggestion = (pic) => {
    const words = advancedText.split(/\s+/);
    words[words.length - 1] = pic.texto;
    const newText = words.join(' ') + ' ';
    setAdvancedText(newText);
    setSuggestions([]);
    speakText(pic.texto);
  };

  const handlePlayAdvancedText = () => {
    if (!advancedText.trim()) return;
    speakText(advancedText.trim());
  };

  const handleSendAdvancedText = async () => {
    if (!advancedText.trim() || !padreVinculado) return;

    const msgData = {
      emisor_id: profile.id_usuario,
      receptor_id: padreVinculado.id_padre,
      mensaje: advancedText.trim(),
      tipo: 'texto'
    };

    try {
      if (isOffline) {
        const localMsg = await queueMessage(msgData);
        if (localMsg) setChatMessages(prev => [...prev, localMsg]);
      } else {
        const { data, error } = await supabase.from('mensajes').insert([msgData]).select();
        if (error) throw error;
        setChatMessages(prev => [...prev, data[0]]);
      }
      setAdvancedText('');
      setAdvancedPictos([]);
    } catch (err) {
      console.error(err);
    }
  };

  // Plantillas
  const getCompiledTemplateText = (tmpl) => {
    let text = tmpl.text;
    if (tmpl.hasInput) {
      const val = templateInputs[tmpl.label] || '';
      text = text.replace(/\[.*?\]/, val || '___');
    }
    return text;
  };

  const handleExecuteTemplate = (tmpl) => {
    const text = getCompiledTemplateText(tmpl);
    speakText(text);
  };

  const handleSendTemplateToChat = async (tmpl) => {
    if (!padreVinculado) return;
    const text = getCompiledTemplateText(tmpl);
    
    const msgData = {
      emisor_id: profile.id_usuario,
      receptor_id: padreVinculado.id_padre,
      mensaje: text,
      tipo: 'texto'
    };

    try {
      if (isOffline) {
        const localMsg = await queueMessage(msgData);
        if (localMsg) setChatMessages(prev => [...prev, localMsg]);
      } else {
        const { data, error } = await supabase.from('mensajes').insert([msgData]).select();
        if (error) throw error;
        setChatMessages(prev => [...prev, data[0]]);
      }
      setTemplateInputs(prev => ({ ...prev, [tmpl.label]: '' }));
    } catch (err) {
      console.error(err);
    }
  };

  // Dictado de Voz (STT)
  const handleToggleVoiceRecord = () => {
    if (isRecording) {
      if (sttSession) sttSession.stop();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      const session = new SpeechToTextSession(
        async (resultText) => {
          console.log('[STT] Texto reconocido:', resultText);
          speakText(`Entendido: ${resultText}`);
          
          if (interfaceConfig.showTextInput) {
            setAdvancedText(prev => prev ? `${prev} ${resultText}` : resultText);
          } else {
            const words = resultText.toLowerCase().split(/\s+/);
            const mapped = [];
            for (const w of words) {
              const clean = w.replace(/[.,#!$%&;:{}=\-_~()¿?]/g, "").replace(/\//g, "").replace(/\*/g, "").replace(/\^/g, "");
              if (clean) {
                const res = await searchPictograms(clean);
                if (res.length > 0) {
                  mapped.push(res[0]);
                }
              }
            }
            if (mapped.length > 0) {
              setPhrase(prev => [...prev, ...mapped]);
            }
          }
        },
        (status) => {
          if (status === 'unsupported') {
            speakText('El dictado por voz no está disponible en este dispositivo.');
          } else if (status === 'error') {
            speakText('Hubo un error con el micrófono. Inténtalo de nuevo.');
          }
          if (status === 'stopped' || status === 'error' || status === 'unsupported') {
            setIsRecording(false);
          }
        }
      );
      session.start();
      setSttSession(session);
    }
  };

  // Botón de Pánico
  const triggerPanicButton = () => {
    if (!profile) {
      speakText('Espera a que cargue tu perfil, por favor.');
      return;
    }
    setPanicOverlay(true);
    setPanicCountdown(3);
    setPanicStatus('counting');

    countdownIntervalRef.current = setInterval(() => {
      setPanicCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          executePanicAlert();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelPanicButton = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setPanicOverlay(false);
    setPanicStatus('');
    speakText('Alerta cancelada. Todo está bien.');
  };

  const executePanicAlert = () => {
    setPanicStatus('triggered');
    speakText('Alerta activada. Tus papás y terapeuta han sido notificados. Mantén la calma.');

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locString = `${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`;
          await savePanicAlert(locString);
        },
        async (error) => {
          console.warn('No se pudo obtener ubicación GPS, usando fallback con mock simulado:', error.message);
          // Ubicación mock simulada segura para testing/desarrollo o si falla GPS real
          await savePanicAlert('19.432608,-99.133208 (Simulado)');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      savePanicAlert('19.432608,-99.133208 (Simulado)');
    }
  };

  const savePanicAlert = async (location) => {
    if (!profile) {
      console.warn('[Panic] Perfil no cargado, no se pudo registrar la alerta.');
      return;
    }
    const alertData = {
      id_paciente: profile.id_usuario,
      ubicacion: location
    };

    try {
      if (isOffline) {
        await queuePanicAlert(alertData);
      } else {
        const { error } = await supabase.from('alertas').insert([alertData]);
        if (error) throw error;
        await sendPanicNotification(profile.correo || 'Paciente Anónimo', location);
      }
    } catch (err) {
      console.error('Error al registrar alerta de pánico:', err);
    }
  };

  const handleSendTextChatMessage = async (e) => {
    e.preventDefault();
    if (!newMsgText.trim() || !padreVinculado) return;

    const msgData = {
      emisor_id: profile.id_usuario,
      receptor_id: padreVinculado.id_padre,
      mensaje: newMsgText.trim(),
      tipo: 'texto'
    };

    try {
      if (isOffline) {
        const localMsg = await queueMessage(msgData);
        if (localMsg) setChatMessages(prev => [...prev, localMsg]);
      } else {
        const { data, error } = await supabase.from('mensajes').insert([msgData]).select();
        if (error) throw error;
        setChatMessages(prev => [...prev, data[0]]);
      }
      setNewMsgText('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={styles.container}>
      {showTestBanner && (
        <div id="dashboard-success-banner" style={styles.testBanner}>
          <div style={styles.testBannerContent}>
            <span style={{ fontSize: '1.4rem' }}>🎉</span>
            <div style={{ textAlign: 'left' }}>
              <strong>¡Prueba de Autenticación Exitosa!</strong>
              <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                Se inició sesión correctamente y se cargó el Dashboard para el rol de PACIENTE (Hijo TEA).
              </div>
            </div>
            <button onClick={() => setShowTestBanner(false)} style={styles.testBannerClose}>&times;</button>
          </div>
        </div>
      )}
      {/* Cabecera */}
      <header style={styles.header}>
        <div style={styles.headerInfo}>
          <img src="/dino-logo.png" alt="Dino" style={styles.headerLogo} onError={(e) => e.target.src = '/dino_logo_1780409837097.png'} />
          <div>
            <h1 style={{ fontSize: '1.5rem', color: 'var(--color-brand)' }}>¡Hola!</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={styles.badgeEtapa}>Etapa: {etapa} años</span>
              <span style={styles.badgeNivel}>Nivel: {comunicacionLevel}</span>
            </div>
          </div>
        </div>

        {/* Nivel Base Selector */}
        <div style={styles.levelSelector}>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-text-muted)' }}>Probar nivel:</label>
          <select 
            value={comunicacionLevel} 
            onChange={(e) => {
              setComunicacionLevel(e.target.value);
              setPhrase([]);
              setAdvancedText('');
              setAdvancedPictos([]);
            }}
            style={styles.selectLevel}
          >
            <option value="Básico">Básico</option>
            <option value="Intermedio">Intermedio</option>
            <option value="Avanzado">Avanzado</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* BOTÓN CONFIGURACIÓN DE ACCESIBILIDAD */}
          <button 
            style={styles.settingsBtn} 
            onClick={() => setSettingsOpen(true)}
            aria-label="Configurar Interfaz de Comunicación"
            title="Configurar interfaz"
          >
            <Settings size={22} />
          </button>

          {/* BOTÓN DE PÁNICO */}
          <button 
            style={styles.panicBtn} 
            onClick={triggerPanicButton}
            aria-label="Botón de Pánico - Pedir ayuda"
          >
            <AlertCircle size={22} /> AYUDA
          </button>
        </div>
      </header>

      {isOffline && (
        <div style={styles.offlineBanner}>
          <WifiOff size={20} /> Modo Offline - Tu comunicador y botón de pánico siguen funcionando sin internet
        </div>
      )}

      {/* ----------------------------------------------------
          BARRA DE FRASES / ENTRADA PRINCIPAL (CON CONFIGURACIÓN)
          ---------------------------------------------------- */}
      {interfaceConfig.showTextInput ? (
        /* VISTA HÍBRIDA/AVANZADA: ENTRADA DE TECLADO CON TRADUCCIÓN Y SUGERENCIAS */
        <section style={styles.advancedTextSection}>
          {/* Fila de Sugerencias Predictivas */}
          {interfaceConfig.showSuggestions && suggestions.length > 0 && (
            <div style={styles.suggestionRow}>
              {suggestions.map((pic) => (
                <button
                  key={pic.id}
                  onClick={() => handleSelectSuggestion(pic)}
                  style={styles.suggestionChip}
                >
                  <img src={pic.imagen} alt={pic.texto} style={styles.suggestionImg} onError={(e) => e.target.src = '/placeholder-word.png'} />
                  <span>{pic.texto}</span>
                </button>
              ))}
            </div>
          )}

          {/* Campo de Texto e Input Híbrido */}
          <div style={styles.advancedInputRow}>
            <input
              type="text"
              placeholder="Escribe lo que quieres decir aquí..."
              value={advancedText}
              onChange={(e) => setAdvancedText(e.target.value)}
              style={styles.advancedInput}
            />
            {advancedText && (
              <button 
                style={styles.clearTextBtn} 
                onClick={() => { setAdvancedText(''); setAdvancedPictos([]); }}
                title="Limpiar texto"
              >
                x
              </button>
            )}
            <button className="btn btn-secondary" onClick={handlePlayAdvancedText} style={styles.advancedActionBtn} disabled={!advancedText.trim()}>
              <Volume2 size={24} />
            </button>
            {padreVinculado && (
              <button className="btn btn-primary" onClick={handleSendAdvancedText} style={styles.advancedActionBtn} disabled={!advancedText.trim()}>
                <Send size={20} /> Enviar
              </button>
            )}
          </div>

          {/* Visualizador de Pictogramas en Tiempo Real */}
          {advancedPictos.length > 0 && (
            <div style={styles.realtimePictosRow}>
              {advancedPictos.map((pic, idx) => (
                <div key={`${pic.id}-${idx}`} style={styles.realtimePictoCard} className={`pic-${pic.categoria}`}>
                  <img src={pic.imagen} alt={pic.texto} onError={(e) => e.target.src = '/placeholder-word.png'} />
                  <span>{pic.texto}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        /* VISTA BÁSICA: BARRA DE FICHA DE PICTOGRAMAS ACUMULATIVOS */
        <section style={styles.phraseSection}>
          <div className="phrase-bar" style={styles.phraseBarCustom}>
            {phrase.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', margin: 'auto', fontSize: '1.15rem', fontWeight: 'bold' }}>
                {interfaceConfig.showStarters 
                  ? 'Elige una Tarjeta de Inicio abajo para estructurar tu frase...' 
                  : 'Toca los pictogramas abajo para hablar...'}
              </p>
            ) : (
              phrase.map((pic, idx) => (
                <div 
                  key={`${pic.id}-${idx}`} 
                  className={`phrase-item pic-${pic.categoria}`}
                  style={styles.phrasePictoItem}
                >
                  <img src={pic.imagen} alt={pic.texto} onError={(e) => e.target.src = '/placeholder-word.png'} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{pic.texto}</span>
                  <button 
                    className="btn-remove" 
                    onClick={() => handleRemovePicto(idx)}
                    style={styles.removeBtn}
                  >
                    x
                  </button>
                </div>
              ))
            )}
          </div>

          {phrase.length > 0 && (
            <div style={styles.phraseActions}>
              <button className="btn" onClick={() => setPhrase([])} style={styles.clearBtn}>
                <Trash2 size={20} /> Borrar
              </button>
              <button className="btn btn-secondary" onClick={handlePlayPhrase} style={styles.actionBtn}>
                <Volume2 size={22} /> Escuchar
              </button>
              {padreVinculado && (
                <button className="btn btn-primary" onClick={handleSendPhraseToChat} style={styles.actionBtn}>
                  <Send size={20} /> Enviar a Papá
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* INDICADOR DE PASOS GUÍA */}
      {interfaceConfig.showStepGuide && (
        <div style={styles.stepIndicator}>
          <div style={{
            ...styles.stepCircle, 
            backgroundColor: ((interfaceConfig.showTextInput && advancedText.trim()) || (!interfaceConfig.showTextInput && phrase.length > 0)) ? '#34d399' : 'var(--color-brand)'
          }}>
            {((interfaceConfig.showTextInput && advancedText.trim()) || (!interfaceConfig.showTextInput && phrase.length > 0)) ? '✓' : '1'}
          </div>
          <span style={{ 
            fontWeight: !((interfaceConfig.showTextInput && advancedText.trim()) || (!interfaceConfig.showTextInput && phrase.length > 0)) ? 'bold' : 'normal',
            color: !((interfaceConfig.showTextInput && advancedText.trim()) || (!interfaceConfig.showTextInput && phrase.length > 0)) ? 'var(--color-text-main)' : 'var(--color-text-muted)'
          }}>
            Paso 1: Elige cómo empezar
          </span>
          <div style={styles.stepLine}></div>
          <div style={{
            ...styles.stepCircle, 
            backgroundColor: ((interfaceConfig.showTextInput && advancedText.trim()) || (!interfaceConfig.showTextInput && phrase.length > 0)) ? 'var(--color-brand)' : '#cbd5e1'
          }}>
            2
          </div>
          <span style={{ 
            fontWeight: ((interfaceConfig.showTextInput && advancedText.trim()) || (!interfaceConfig.showTextInput && phrase.length > 0)) ? 'bold' : 'normal',
            color: ((interfaceConfig.showTextInput && advancedText.trim()) || (!interfaceConfig.showTextInput && phrase.length > 0)) ? 'var(--color-text-main)' : 'var(--color-text-muted)'
          }}>
            Paso 2: Completa tu idea
          </span>
        </div>
      )}

      {/* ----------------------------------------------------
          ÁREA PRINCIPAL DE TRABAJO
          ---------------------------------------------------- */}
      <main style={styles.mainGrid}>
        
        {/* Barra lateral si hay elementos de navegación activos */}
        {(interfaceConfig.showPictoGrid || interfaceConfig.showTemplates) && (
          <div style={styles.categoriesSidebar}>
            
            {/* Split selector de barra lateral si ambos tableros están activos */}
            {interfaceConfig.showPictoGrid && interfaceConfig.showTemplates && (
              <div style={styles.toggleBar}>
                <button
                  style={{
                    ...styles.toggleBarBtn,
                    backgroundColor: sidebarMode === 'tablero' ? 'white' : 'transparent',
                    color: sidebarMode === 'tablero' ? 'var(--color-brand)' : 'var(--color-text-muted)',
                    boxShadow: sidebarMode === 'tablero' ? 'var(--shadow-sm)' : 'none'
                  }}
                  onClick={() => setSidebarMode('tablero')}
                >
                  Tablero
                </button>
                <button
                  style={{
                    ...styles.toggleBarBtn,
                    backgroundColor: sidebarMode === 'plantillas' ? 'white' : 'transparent',
                    color: sidebarMode === 'plantillas' ? 'var(--color-brand)' : 'var(--color-text-muted)',
                    boxShadow: sidebarMode === 'plantillas' ? 'var(--shadow-sm)' : 'none'
                  }}
                  onClick={() => setSidebarMode('plantillas')}
                >
                  Plantillas
                </button>
              </div>
            )}

            {/* Renderizado de Categorías */}
            {sidebarMode === 'tablero' && interfaceConfig.showPictoGrid && (
              categories.map(cat => (
                <button
                  key={cat}
                  style={{
                    ...styles.categoryTab,
                    borderLeft: selectedCategory === cat ? '6px solid var(--color-brand)' : 'none',
                    backgroundColor: selectedCategory === cat ? 'var(--color-brand-light)' : 'white',
                    color: selectedCategory === cat ? 'var(--color-brand)' : 'var(--color-text-main)'
                  }}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span style={{ textTransform: 'capitalize', fontSize: '1.15rem' }}>{cat}</span>
                </button>
              ))
            )}

            {/* Renderizado de Plantillas */}
            {sidebarMode === 'plantillas' && interfaceConfig.showTemplates && (
              <>
                <h4 style={styles.templateSidebarTitle}>Plantillas</h4>
                {Object.keys(ADVANCED_TEMPLATES).map(tab => (
                  <button
                    key={tab}
                    style={{
                      ...styles.categoryTab,
                      borderLeft: selectedTemplateTab === tab ? '6px solid var(--color-brand)' : 'none',
                      backgroundColor: selectedTemplateTab === tab ? 'var(--color-brand-light)' : 'white',
                      color: selectedTemplateTab === tab ? 'var(--color-brand)' : 'var(--color-text-main)'
                    }}
                    onClick={() => setSelectedTemplateTab(tab)}
                  >
                    <span style={{ textTransform: 'capitalize', fontSize: '1.1rem' }}>
                      {tab === 'transporte' && '🚌 Autobús'}
                      {tab === 'compras' && '🛒 Compras'}
                      {tab === 'restaurante' && '🍽️ Comida'}
                      {tab === 'emergencias' && '🚨 Emergencia'}
                    </span>
                  </button>
                ))}
              </>
            )}
            
            <button 
              style={{
                ...styles.categoryTab,
                borderLeft: chatOpen ? '6px solid var(--color-acciones)' : 'none',
                backgroundColor: chatOpen ? '#ecfdf5' : 'white',
                color: chatOpen ? 'var(--color-acciones)' : 'var(--color-text-main)',
                marginTop: 'auto'
              }}
              onClick={() => setChatOpen(!chatOpen)}
            >
              <MessageCircle size={22} />
              <span>Chat ({chatMessages.length})</span>
            </button>
          </div>
        )}

        {/* Panel de visualización de grids */}
        <div style={styles.pictogramsArea}>
          
          {/* Tarjetas de inicio */}
          {interfaceConfig.showStarters && sidebarMode === 'tablero' && 
           ((interfaceConfig.showTextInput && !advancedText.trim()) || (!interfaceConfig.showTextInput && phrase.length === 0)) && (
            <div style={styles.startersContainer}>
              <h3 style={styles.startersTitle}>¿Cómo quieres empezar tu frase?</h3>
              <div style={styles.starterGrid}>
                {STARTERS.map((starter) => (
                  <button
                    key={starter.text}
                    onClick={() => handleSelectStarter(starter)}
                    style={styles.starterCard}
                  >
                    <span style={styles.starterIcon}>{starter.icon}</span>
                    <span style={styles.starterText}>{starter.text}...</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Grilla de pictogramas */}
          {sidebarMode === 'tablero' && interfaceConfig.showPictoGrid && (
            loadingPictos ? (
              <div style={styles.loadingArea}>
                <div style={styles.spinner}></div>
                <p>Cargando opciones...</p>
              </div>
            ) : (
              <div className="pictogram-grid" style={styles.pictoGrid}>
                {items[selectedCategory]?.map(term => {
                  const pic = loadedPictos[term];
                  if (!pic) return null;
                  return (
                    <div
                      key={pic.id}
                      className={`pictogram-card pic-${pic.categoria}`}
                      onClick={() => handleAddPicto(pic)}
                      style={styles.accessiblePictoCard}
                    >
                      <img src={pic.imagen} alt={pic.texto} onError={(e) => e.target.src = '/placeholder-word.png'} />
                      <span style={{ fontWeight: 'bold' }}>{pic.texto}</span>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Plantillas de Autonomía */}
          {sidebarMode === 'plantillas' && interfaceConfig.showTemplates && (
            <>
              <h3 style={styles.templatesHeader}>
                {selectedTemplateTab === 'transporte' && 'Frases de Autobús y Transporte Público'}
                {selectedTemplateTab === 'compras' && 'Frases útiles para hacer Compras'}
                {selectedTemplateTab === 'restaurante' && 'Frases útiles en Restaurantes / Cafeterías'}
                {selectedTemplateTab === 'emergencias' && 'Mensajes de Emergencia y Cuidado'}
              </h3>
              
              <div style={styles.templatesGrid}>
                {ADVANCED_TEMPLATES[selectedTemplateTab].map((tmpl, idx) => {
                  if (tmpl.hasInput) {
                    return (
                      <div 
                        key={idx} 
                        style={{
                          ...styles.templateCardWithInput,
                          borderLeft: tmpl.isPanic ? '6px solid var(--color-panic)' : '6px solid var(--color-brand)'
                        }}
                      >
                        <span style={styles.templateLabel}>{tmpl.label}</span>
                        <div style={styles.templateInputGroup}>
                          <input
                            type="text"
                            placeholder={tmpl.placeholder}
                            value={templateInputs[tmpl.label] || ''}
                            onChange={(e) => setTemplateInputs(prev => ({ ...prev, [tmpl.label]: e.target.value }))}
                            style={styles.templateInput}
                          />
                          <div style={styles.templateCardActions}>
                            <button
                              onClick={() => handleExecuteTemplate(tmpl)}
                              style={styles.templateActionBtnSmall}
                              title="Escuchar frase"
                            >
                              <Volume2 size={20} />
                            </button>
                            {padreVinculado && (
                              <button
                                onClick={() => handleSendTemplateToChat(tmpl)}
                                style={styles.templateSendBtnSmall}
                                title="Enviar mensaje"
                              >
                                <Send size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={idx} 
                      style={{
                        ...styles.templateCard,
                        borderLeft: tmpl.isPanic ? '6px solid var(--color-panic)' : '6px solid var(--color-brand)',
                        backgroundColor: tmpl.isPanic ? '#fff5f5' : 'white'
                      }}
                    >
                      <span style={{
                        ...styles.templateText,
                        color: tmpl.isPanic ? 'var(--color-panic)' : 'var(--color-text-main)',
                        fontWeight: tmpl.isPanic ? 'bold' : 'normal'
                      }}>{tmpl.text}</span>
                      <div style={styles.templateCardActions}>
                        <button
                          onClick={() => handleExecuteTemplate(tmpl)}
                          style={{
                            ...styles.templateActionBtnSmall,
                            backgroundColor: tmpl.isPanic ? '#fee2e2' : 'var(--color-brand-light)',
                            color: tmpl.isPanic ? 'var(--color-panic)' : 'var(--color-brand)'
                          }}
                          title="Escuchar frase"
                        >
                          <Volume2 size={20} />
                        </button>
                        {padreVinculado && (
                          <button
                            onClick={() => handleSendTemplateToChat(tmpl)}
                            style={{
                              ...styles.templateSendBtnSmall,
                              backgroundColor: tmpl.isPanic ? '#fee2e2' : 'var(--color-brand-light)',
                              color: tmpl.isPanic ? 'var(--color-panic)' : 'var(--color-brand)'
                            }}
                            title="Enviar a Papá"
                          >
                            <Send size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Grabación de voz (STT) */}
          {interfaceConfig.showVoiceSTT && (
            <div style={styles.voiceRecordArea}>
              <button
                style={{
                  ...styles.recordBtn,
                  backgroundColor: isRecording ? 'var(--color-panic)' : 'var(--color-brand)',
                  animation: isRecording ? 'pulse-record 1.5s infinite' : 'none'
                }}
                onClick={handleToggleVoiceRecord}
                aria-label="Dictar voz al comunicador"
              >
                <Mic size={32} color="white" />
              </button>
              <span style={{ fontWeight: 'bold', color: 'var(--color-text-muted)', fontSize: '1.1rem' }}>
                {isRecording ? '¡Te escucho! Habla ahora...' : 'Toca el micrófono para hablar por voz'}
              </span>
            </div>
          )}

        </div>
      </main>

      {/* CHAT FLOTANTE */}
      {chatOpen && padreVinculado && (
        <div style={styles.chatDock}>
          <div style={styles.chatDockHeader}>
            <h3 style={{ fontSize: '1.1rem' }}>Chat con Papá/Mamá</h3>
            <button style={styles.closeDockBtn} onClick={() => setChatOpen(false)}>x</button>
          </div>
          <div style={styles.chatDockBody}>
            <div className="chat-messages" style={{ padding: 12 }}>
              {chatMessages.map(msg => (
                <div 
                  key={msg.id_mensaje}
                  className={`chat-bubble ${msg.emisor_id === profile.id_usuario ? 'bubble-sent' : 'bubble-received'}`}
                  style={{ fontSize: '0.95rem', padding: '10px 14px' }}
                >
                  <p style={{ margin: 0 }}>{msg.mensaje}</p>
                  <span style={styles.chatTime}>
                    {new Date(msg.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>
          <form onSubmit={handleSendTextChatMessage} style={styles.chatDockInput}>
            <input
              className="form-input"
              type="text"
              placeholder="Escribe un mensaje..."
              value={newMsgText}
              onChange={(e) => setNewMsgText(e.target.value)}
              style={{ height: '44px', fontSize: '1rem', padding: '8px 12px' }}
            />
            <button type="submit" className="btn btn-primary" style={{ minHeight: '44px', padding: '0 16px' }}>
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      {/* OVERLAY DE PÁNICO */}
      {panicOverlay && (
        <div style={styles.overlay}>
          <div style={styles.overlayCard}>
            {panicStatus === 'counting' && (
              <>
                <div style={styles.panicWarningIcon}>
                  <AlertCircle size={80} color="white" />
                </div>
                <h2 style={{ fontSize: '2.2rem', color: 'var(--color-panic)' }}>¿Necesitas ayuda?</h2>
                <p style={{ fontSize: '1.3rem', color: 'var(--color-text-main)', margin: '14px 0' }}>
                  Notificando a tu familia en:
                </p>
                <div style={styles.countdownNumber}>{panicCountdown}</div>
                <button 
                  className="btn btn-secondary" 
                  onClick={cancelPanicButton}
                  style={styles.cancelPanicBtn}
                >
                  Cancelar Alerta
                </button>
              </>
            )}

            {panicStatus === 'triggered' && (
              <>
                <div style={{ ...styles.panicWarningIcon, backgroundColor: 'var(--color-acciones)' }}>
                  <Shield size={80} color="white" />
                </div>
                <h2 style={{ fontSize: '2.2rem', color: 'var(--color-acciones)' }}>¡Ayuda en Camino!</h2>
                <p style={{ fontSize: '1.3rem', margin: '16px 0 24px 0' }}>
                  Tus papás y tu terapeuta recibieron tu ubicación y ya vienen a ayudarte. Mantén la calma.
                </p>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setPanicOverlay(false)}
                  style={{ width: '100%' }}
                >
                  Entendido
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL DE CONFIGURACIÓN DE ACCESIBILIDAD / INTERFAZ
          ======================================================== */}
      {settingsOpen && (
        <div style={styles.overlay}>
          <div style={styles.settingsOverlayCard}>
            <div style={styles.settingsHeader}>
              <h2 style={{ fontSize: '1.6rem', color: 'var(--color-brand)' }}>Configurar Interfaz</h2>
              <button style={styles.closeDockBtn} onClick={() => setSettingsOpen(false)}>x</button>
            </div>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '18px', fontSize: '0.95rem' }}>
              Activa o desactiva las herramientas en pantalla para personalizar la comunicación visual.
            </p>
            <div style={styles.settingsList}>
              <div style={styles.settingItem}>
                <div>
                  <span style={styles.settingLabel}>Tarjetas de Inicio (Estructurador)</span>
                  <p style={styles.settingDesc}>Muestra inicios de frases como "Yo quiero..." o "Me duele..."</p>
                </div>
                <input
                  type="checkbox"
                  checked={interfaceConfig.showStarters}
                  onChange={(e) => setInterfaceConfig(prev => ({ ...prev, showStarters: e.target.checked }))}
                  style={styles.toggleCheckbox}
                />
              </div>

              <div style={styles.settingItem}>
                <div>
                  <span style={styles.settingLabel}>Indicador de Pasos Guía</span>
                  <p style={styles.settingDesc}>Ayuda visual paso a paso para estructurar ideas</p>
                </div>
                <input
                  type="checkbox"
                  checked={interfaceConfig.showStepGuide}
                  disabled={!interfaceConfig.showStarters}
                  onChange={(e) => setInterfaceConfig(prev => ({ ...prev, showStepGuide: e.target.checked }))}
                  style={styles.toggleCheckbox}
                />
              </div>

              <div style={styles.settingItem}>
                <div>
                  <span style={styles.settingLabel}>Tablero de Pictogramas (Categorías)</span>
                  <p style={styles.settingDesc}>Muestra la grilla de pictogramas seleccionables por categoría</p>
                </div>
                <input
                  type="checkbox"
                  checked={interfaceConfig.showPictoGrid}
                  onChange={(e) => setInterfaceConfig(prev => ({ ...prev, showPictoGrid: e.target.checked }))}
                  style={styles.toggleCheckbox}
                />
              </div>

              <div style={styles.settingItem}>
                <div>
                  <span style={styles.settingLabel}>Teclado y Entrada de Texto</span>
                  <p style={styles.settingDesc}>Permite escribir de forma libre usando el teclado del dispositivo</p>
                </div>
                <input
                  type="checkbox"
                  checked={interfaceConfig.showTextInput}
                  onChange={(e) => setInterfaceConfig(prev => ({ ...prev, showTextInput: e.target.checked }))}
                  style={styles.toggleCheckbox}
                />
              </div>

              <div style={styles.settingItem}>
                <div>
                  <span style={styles.settingLabel}>Sugerencias Predictivas</span>
                  <p style={styles.settingDesc}>Muestra pictogramas de autocompletado en la parte superior del teclado</p>
                </div>
                <input
                  type="checkbox"
                  checked={interfaceConfig.showSuggestions}
                  disabled={!interfaceConfig.showTextInput}
                  onChange={(e) => setInterfaceConfig(prev => ({ ...prev, showSuggestions: e.target.checked }))}
                  style={styles.toggleCheckbox}
                />
              </div>

              <div style={styles.settingItem}>
                <div>
                  <span style={styles.settingLabel}>Plantillas de Autonomía Diaria</span>
                  <p style={styles.settingDesc}>Muestra diálogos rápidos útiles para compras, viajes y restaurantes</p>
                </div>
                <input
                  type="checkbox"
                  checked={interfaceConfig.showTemplates}
                  onChange={(e) => setInterfaceConfig(prev => ({ ...prev, showTemplates: e.target.checked }))}
                  style={styles.toggleCheckbox}
                />
              </div>

              <div style={styles.settingItem}>
                <div>
                  <span style={styles.settingLabel}>Micrófono y Reconocimiento de Voz</span>
                  <p style={styles.settingDesc}>Habilita el botón de grabación de voz para dictar texto</p>
                </div>
                <input
                  type="checkbox"
                  checked={interfaceConfig.showVoiceSTT}
                  onChange={(e) => setInterfaceConfig(prev => ({ ...prev, showVoiceSTT: e.target.checked }))}
                  style={styles.toggleCheckbox}
                />
              </div>
            </div>
            
            <button 
              className="btn btn-primary" 
              onClick={() => setSettingsOpen(false)}
              style={{ width: '100%', marginTop: '20px', borderRadius: '16px' }}
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-record {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
    position: 'relative',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    backgroundColor: 'white',
    borderBottom: '2px solid var(--color-border)',
    flexShrink: 0,
    gap: '12px'
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    textAlign: 'left'
  },
  headerLogo: {
    width: '50px',
    height: '50px',
    objectFit: 'contain'
  },
  badgeEtapa: {
    backgroundColor: '#eff6ff',
    color: 'var(--color-brand)',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    fontWeight: 'bold'
  },
  badgeNivel: {
    backgroundColor: '#faf5ff',
    color: '#a78bfa',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    fontWeight: 'bold'
  },
  levelSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#f8fafc',
    padding: '6px 14px',
    borderRadius: '16px',
    border: '1px solid var(--color-border)'
  },
  selectLevel: {
    padding: '6px 10px',
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'white',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    outline: 'none',
    cursor: 'pointer',
    color: 'var(--color-text-main)'
  },
  settingsBtn: {
    backgroundColor: '#f1f5f9',
    color: 'var(--color-text-muted)',
    border: '1px solid var(--color-border)',
    borderRadius: '14px',
    width: '44px',
    height: '44px',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    transition: 'var(--transition-smooth)'
  },
  panicBtn: {
    backgroundColor: 'var(--color-panic)',
    color: 'white',
    fontSize: '1.1rem',
    fontWeight: '800',
    padding: '10px 20px',
    borderRadius: '16px',
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
    cursor: 'pointer',
    border: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '48px'
  },
  offlineBanner: {
    backgroundColor: '#fffbeb',
    color: '#b45309',
    padding: '10px 18px',
    fontWeight: 'bold',
    fontSize: '0.95rem',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    flexShrink: 0
  },
  phraseSection: {
    padding: '16px 24px 0 24px',
    flexShrink: 0,
    backgroundColor: 'var(--bg-primary)'
  },
  phraseBarCustom: {
    minHeight: '100px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    backgroundColor: 'white',
    border: '3px dashed var(--color-border)',
    borderRadius: '24px',
    padding: '16px',
    marginBottom: '16px',
    alignItems: 'center'
  },
  phrasePictoItem: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '90px',
    height: '90px',
    padding: '8px',
    borderRadius: '16px',
    backgroundColor: 'white',
    boxShadow: 'var(--shadow-sm)',
    border: '3px solid #e2e8f0'
  },
  removeBtn: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    width: '24px',
    height: '24px',
    minHeight: '24px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-panic)',
    color: 'white',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
  },
  phraseActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginBottom: '16px'
  },
  actionBtn: {
    fontSize: '1.05rem',
    padding: '10px 20px',
    borderRadius: '14px'
  },
  clearBtn: {
    fontSize: '1rem',
    padding: '10px 16px',
    borderRadius: '14px',
    backgroundColor: '#fee2e2',
    color: 'var(--color-panic)',
    border: '1px solid #fecaca'
  },
  mainGrid: {
    display: 'flex',
    flexGrow: 1,
    overflow: 'hidden'
  },
  categoriesSidebar: {
    width: '200px',
    backgroundColor: 'white',
    borderRight: '2px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 0',
    flexShrink: 0
  },
  templateSidebarTitle: {
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0 20px 8px 20px',
    borderBottom: '1px solid var(--color-border)',
    marginBottom: '10px',
    textAlign: 'left'
  },
  categoryTab: {
    background: 'none',
    border: 'none',
    textAlign: 'left',
    padding: '16px 20px',
    cursor: 'pointer',
    fontWeight: 'bold',
    borderRadius: '0 12px 12px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '52px',
    transition: 'var(--transition-smooth)'
  },
  pictogramsArea: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    padding: '20px',
    backgroundColor: 'var(--bg-primary)',
    position: 'relative'
  },
  pictoGrid: {
    flexGrow: 1,
    alignContent: 'start',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: '16px',
    marginBottom: '20px'
  },
  accessiblePictoCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    borderRadius: '20px',
    backgroundColor: 'white',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
    transition: 'var(--transition-smooth)',
    border: '4px solid #cbd5e1',
    aspectRatio: '1/1',
    userSelect: 'none'
  },
  voiceRecordArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginTop: 'auto',
    padding: '12px 20px',
    backgroundColor: 'white',
    borderRadius: '24px',
    boxShadow: 'var(--shadow-sm)',
    flexShrink: 0,
    border: '1px solid var(--color-border)'
  },
  recordBtn: {
    width: '56px',
    height: '56px',
    minHeight: '56px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)'
  },
  loadingArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    margin: 'auto'
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '4px solid rgba(59, 130, 246, 0.1)',
    borderTopColor: 'var(--color-brand)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  chatDock: {
    width: '320px',
    borderLeft: '2px solid var(--color-border)',
    backgroundColor: 'white',
    display: 'flex',
    flexDirection: 'column',
    position: 'absolute',
    right: 0,
    top: '72px',
    bottom: 0,
    zIndex: 10,
    boxShadow: 'var(--shadow-lg)'
  },
  chatDockHeader: {
    padding: '16px',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--color-brand-light)'
  },
  closeDockBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.4rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    minHeight: 'auto',
    padding: '0 6px',
    color: 'var(--color-text-muted)'
  },
  chatDockBody: {
    flexGrow: 1,
    overflowY: 'auto',
    backgroundColor: '#f8fafc'
  },
  chatDockInput: {
    padding: '12px',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    gap: '8px',
    backgroundColor: 'white'
  },
  chatTime: {
    display: 'block',
    fontSize: '0.7rem',
    textAlign: 'right',
    opacity: 0.8,
    marginTop: '2px'
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  overlayCard: {
    backgroundColor: 'white',
    borderRadius: '32px',
    padding: '40px',
    maxWidth: '440px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  panicWarningIcon: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-panic)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
    boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4)'
  },
  countdownNumber: {
    fontSize: '4.5rem',
    fontWeight: '800',
    color: 'var(--color-panic)',
    margin: '10px 0 20px 0',
    fontFamily: 'var(--font-title)'
  },
  cancelPanicBtn: {
    width: '100%',
    fontSize: '1.15rem',
    padding: '14px',
    borderRadius: '16px'
  },

  // ----------------------------------------------------
  // ESTILOS NUEVOS (HÍBRIDO Y CONFIGURACIÓN)
  // ----------------------------------------------------
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '8px 24px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid var(--color-border)',
    flexShrink: 0
  },
  stepCircle: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    color: 'white',
    fontSize: '0.9rem'
  },
  stepLine: {
    width: '60px',
    height: '3px',
    backgroundColor: '#cbd5e1',
    borderRadius: '2px'
  },
  startersContainer: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '24px',
    marginBottom: '20px',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--color-border)',
    textAlign: 'left'
  },
  startersTitle: {
    fontSize: '1.25rem',
    color: 'var(--color-brand)',
    marginBottom: '14px',
    fontWeight: 'bold'
  },
  starterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '12px'
  },
  starterCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px 10px',
    borderRadius: '16px',
    border: '2px solid #dbeafe',
    backgroundColor: '#f0f9ff',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
    minHeight: '80px',
    gap: '6px'
  },
  starterIcon: {
    fontSize: '1.8rem'
  },
  starterText: {
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: 'var(--color-brand-hover)'
  },
  
  // Avanzado / Input de texto libre
  advancedTextSection: {
    padding: '16px 24px',
    backgroundColor: 'white',
    borderBottom: '2px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flexShrink: 0
  },
  suggestionRow: {
    display: 'flex',
    gap: '10px',
    overflowX: 'auto',
    paddingBottom: '4px',
    alignItems: 'center'
  },
  suggestionChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    borderRadius: '12px',
    border: '1px solid #c084fc',
    backgroundColor: '#faf5ff',
    color: '#6b21a8',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    minHeight: '36px',
    flexShrink: 0
  },
  suggestionImg: {
    width: '24px',
    height: '24px',
    objectFit: 'contain'
  },
  advancedInputRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    position: 'relative',
    width: '100%'
  },
  advancedInput: {
    flexGrow: 1,
    height: '52px',
    borderRadius: '16px',
    border: '2px solid var(--color-border)',
    padding: '0 44px 0 16px',
    fontSize: '1.15rem',
    outline: 'none',
    fontFamily: 'var(--font-body)',
    transition: 'var(--transition-smooth)'
  },
  clearTextBtn: {
    position: 'absolute',
    right: '180px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    padding: '8px',
    minHeight: 'auto'
  },
  advancedActionBtn: {
    padding: '0 20px',
    minHeight: '52px',
    fontSize: '1rem',
    borderRadius: '16px'
  },
  realtimePictosRow: {
    display: 'flex',
    gap: '10px',
    overflowX: 'auto',
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '16px',
    border: '1px solid var(--color-border)',
    alignItems: 'center',
    minHeight: '80px'
  },
  realtimePictoCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '64px',
    height: '64px',
    padding: '4px',
    borderRadius: '12px',
    backgroundColor: 'white',
    border: '2px solid #cbd5e1',
    flexShrink: 0,
    boxShadow: 'var(--shadow-sm)'
  },
  templatesHeader: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: 'var(--color-text-main)',
    marginBottom: '16px',
    textAlign: 'left'
  },
  templatesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '16px',
    flexGrow: 1,
    alignContent: 'start',
    marginBottom: '20px'
  },
  templateCard: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '120px',
    boxShadow: 'var(--shadow-sm)',
    textAlign: 'left'
  },
  templateText: {
    fontSize: '1rem',
    lineHeight: '1.4'
  },
  templateCardActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '12px'
  },
  templateActionBtnSmall: {
    width: '40px',
    height: '40px',
    minHeight: '40px',
    padding: 0,
    borderRadius: '10px',
    cursor: 'pointer',
    backgroundColor: 'var(--color-brand-light)',
    color: 'var(--color-brand)',
    border: 'none'
  },
  templateSendBtnSmall: {
    width: '40px',
    height: '40px',
    minHeight: '40px',
    padding: 0,
    borderRadius: '10px',
    cursor: 'pointer',
    backgroundColor: '#ecfdf5',
    color: '#059669',
    border: 'none'
  },
  templateCardWithInput: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '125px',
    boxShadow: 'var(--shadow-sm)',
    textAlign: 'left',
    gap: '8px'
  },
  templateLabel: {
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: 'var(--color-text-muted)'
  },
  templateInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  templateInput: {
    height: '38px',
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    padding: '0 10px',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'var(--font-body)'
  },

  // Modal de Configuración Accesible
  settingsOverlayCard: {
    backgroundColor: 'white',
    borderRadius: '28px',
    padding: '30px',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'left',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  settingsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  settingsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginTop: '10px'
  },
  settingItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#f8fafc',
    borderRadius: '16px',
    border: '1px solid var(--color-border)',
    gap: '16px'
  },
  settingLabel: {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: 'var(--color-text-main)',
    display: 'block'
  },
  settingDesc: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    marginTop: '2px',
    lineHeight: '1.3'
  },
  toggleCheckbox: {
    width: '24px',
    height: '24px',
    cursor: 'pointer',
    accentColor: 'var(--color-brand)'
  },
  toggleBar: {
    display: 'flex',
    backgroundColor: '#f1f5f9',
    borderRadius: '14px',
    padding: '4px',
    margin: '0 12px 12px 12px',
    gap: '4px',
    border: '1px solid var(--color-border)',
    flexShrink: 0
  },
  toggleBarBtn: {
    flex: 1,
    padding: '8px 12px',
    minHeight: '36px',
    borderRadius: '10px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    border: 'none',
    transition: 'var(--transition-smooth)'
  },
  testBanner: {
    backgroundColor: '#ecfdf5',
    border: '3px solid #10b981',
    borderRadius: '16px',
    padding: '16px 20px',
    margin: '16px',
    boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.1)',
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
