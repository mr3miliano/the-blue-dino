/**
 * CONTEXTO DE APLICACIÓN GLOBAL (AppContext.jsx)
 * Administra el estado de autenticación de Supabase, perfiles de usuario,
 * conectividad offline/online, y estados de carga globales.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { initFirebaseFCM } from '../services/firebase';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Monitorizar conectividad a internet
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Obtiene los datos del perfil desde la tabla publica 'usuarios' y su rol
  const fetchUserProfile = async (userId) => {
    setLoading(true);
    try {
      // 1. Obtener de la tabla usuarios general
      const { data: userGen, error: genError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id_usuario', userId)
        .single();

      if (genError) throw genError;

      let profileData = { ...userGen };

      // 2. Obtener detalles específicos según el rol
      if (userGen.rol === 'padre') {
        const { data: details } = await supabase
          .from('padres')
          .select('*')
          .eq('id_padre', userId)
          .single();
        profileData = { ...profileData, ...details };
      } else if (userGen.rol === 'paciente') {
        const { data: details } = await supabase
          .from('pacientes')
          .select('*')
          .eq('id_paciente', userId)
          .single();
        profileData = { ...profileData, ...details };
      } else if (userGen.rol === 'terapeuta') {
        const { data: details } = await supabase
          .from('terapeutas')
          .select('*')
          .eq('id_terapeuta', userId)
          .single();
        profileData = { ...profileData, ...details };
      }

      setProfile(profileData);
    } catch (err) {
      console.error('Error al obtener perfil del usuario:', err);
    } finally {
      setLoading(false);
    }
  };

  // Inicializar Firebase FCM y verificar sesión al arrancar
  useEffect(() => {
    initFirebaseFCM();

    // 1. Obtener la sesión activa actual de Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setUser(session.user);
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Iniciar Sesión
  const login = async (email, password) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      setLoading(false);
      throw error;
    }
    return data;
  };

  // Registrar Usuario
  const register = async (email, password, rol, extraData = {}) => {
    setLoading(true);
    // Registrar en Supabase Auth y pasar metadatos para el Trigger PostgreSQL
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          rol,
          etapa_vida: extraData.etapa_vida || '6-12',
          nivel_comunicacion: extraData.nivel_comunicacion || 'Básico',
          telefono: extraData.telefono || '',
          direccion: extraData.direccion || '',
          especialidad: extraData.especialidad || '',
          cedula: extraData.cedula || ''
        }
      }
    });

    if (error) {
      setLoading(false);
      throw error;
    }

    // Nota: El trigger PostgreSQL inserta automáticamente en las tablas correspondientes.
    return data;
  };

  // Cerrar Sesión
  const logout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        profile,
        loading,
        isOffline,
        login,
        register,
        logout,
        refreshProfile: () => fetchUserProfile(user?.id)
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp debe usarse dentro de un AppProvider');
  }
  return context;
};
