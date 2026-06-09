/**
 * SERVICIO FIREBASE FCM (firebase.js)
 * Inicializa Firebase y gestiona Firebase Cloud Messaging (FCM) para recibir notificaciones push.
 * Incluye un simulador integrado para probar en desarrollo las notificaciones de botón de pánico y chat.
 */

// Importación condicional o simulación por si no se instalan las SDKs completas de Firebase inmediatamente
// para evitar que falle el proyecto al inicio.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "placeholder-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "placeholder-auth-domain",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "placeholder-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "placeholder-storage-bucket",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "placeholder-sender-id",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "placeholder-app-id"
};

// Simulador de notificaciones locales para desarrollo (muy útil para testing de pánico y chat)
class MockNotificationManager {
  constructor() {
    this.listeners = [];
  }

  // Escuchar cuando llega una notificación simulada
  onNotificationReceived(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Disparar una notificación simulada (pánico o chat)
  triggerNotification(title, body, data = {}) {
    console.log(`[FCM SIMULATION] Recibido: "${title}" - ${body}`, data);
    
    // 1. Mostrar en consola de forma estilizada
    console.log(
      `%c 🚨 ALERTA PUSH: ${title} %c \n${body}`,
      'background: #ef4444; color: white; font-weight: bold; padding: 4px; border-radius: 4px;',
      'color: black;'
    );

    // 2. Disparar a los listeners registrados en la UI
    this.listeners.forEach(cb => cb({ title, body, data }));

    // 3. Mostrar notificación nativa del navegador si hay permisos
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/dino-logo.png' // Icono de la app
      });
    }
  }

  async requestPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log(`[FCM SIMULATION] Permisos de notificación: ${permission}`);
      return permission === 'granted';
    }
    return false;
  }
}

export const mockNotifications = new MockNotificationManager();

// Intentar registrar el service worker si es soportado
export const initFirebaseFCM = async () => {
  if (typeof window === 'undefined') return;

  // Solicitar permisos de notificación nativa
  await mockNotifications.requestPermission();

  console.log('[Firebase FCM] Inicializado en modo de prueba / simulación.');
  console.log('Las notificaciones de pánico y mensajes del chat se simularán localmente y por consola.');
};

/**
 * Dispara una notificación de botón de pánico
 * @param {string} pacienteNombre Nombre del paciente
 * @param {string} ubicacion Coordenadas GPS del paciente
 */
export const sendPanicNotification = async (pacienteNombre, ubicacion) => {
  const title = `🚨 BOTÓN DE PÁNICO: ${pacienteNombre}`;
  const body = `El paciente requiere asistencia inmediata. Ubicación GPS: ${ubicacion}`;
  
  // Simular la recepción en el cliente receptor
  mockNotifications.triggerNotification(title, body, {
    tipo: 'panico',
    paciente: pacienteNombre,
    ubicacion: ubicacion
  });

  // En producción, aquí haríamos un POST a Supabase Edge Functions para enviar la notificación
  // real a Firebase FCM usando el token FCM de los padres y terapeutas vinculados.
};

/**
 * Dispara una notificación de nuevo mensaje en el chat
 * @param {string} emisorNombre Nombre de quien envía el mensaje
 * @param {string} mensajeContenido Texto o tipo de mensaje enviado
 */
export const sendMessageNotification = async (emisorNombre, mensajeContenido) => {
  const title = `💬 Nuevo mensaje de ${emisorNombre}`;
  const body = mensajeContenido.length > 30 ? `${mensajeContenido.slice(0, 30)}...` : mensajeContenido;

  mockNotifications.triggerNotification(title, body, {
    tipo: 'chat'
  });
};
