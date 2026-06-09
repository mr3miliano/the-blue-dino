/**
 * SERVICIO DE SINCRONIZACIÓN OFFLINE (offlineSync.js)
 * Maneja el almacenamiento local de eventos críticos (alertas de pánico, mensajes)
 * y los sincroniza automáticamente con Supabase cuando se recupera la conexión a internet.
 */

import localforage from 'localforage';
import { supabase } from './supabase';

// Inicializar almacenes para colas de sincronización
const offlineStore = localforage.createInstance({
  name: 'the-blue-dino',
  storeName: 'offline-sync-queues'
});

const ALERTS_QUEUE_KEY = 'pending_panic_alerts';
const MESSAGES_QUEUE_KEY = 'pending_chat_messages';

/**
 * Guarda una alerta de pánico localmente si está offline.
 */
export const queuePanicAlert = async (alertData) => {
  try {
    const queue = (await offlineStore.getItem(ALERTS_QUEUE_KEY)) || [];
    queue.push({
      ...alertData,
      id_temp: crypto.randomUUID(), // Identificador temporal para rastreo
      fecha: new Date().toISOString()
    });
    await offlineStore.setItem(ALERTS_QUEUE_KEY, queue);
    console.log('[OfflineSync] Alerta de pánico guardada localmente en la cola offline.');
  } catch (error) {
    console.error('Error al guardar alerta en cola offline:', error);
  }
};

/**
 * Guarda un mensaje localmente si está offline.
 */
export const queueMessage = async (msgData) => {
  try {
    const queue = (await offlineStore.getItem(MESSAGES_QUEUE_KEY)) || [];
    const newMsg = {
      ...msgData,
      id_temp: crypto.randomUUID(),
      fecha: new Date().toISOString()
    };
    queue.push(newMsg);
    await offlineStore.setItem(MESSAGES_QUEUE_KEY, queue);
    console.log('[OfflineSync] Mensaje de chat guardado localmente en la cola offline.');
    return newMsg;
  } catch (error) {
    console.error('Error al guardar mensaje en cola offline:', error);
    return null;
  }
};

/**
 * Procesa la sincronización de todas las colas pendientes con Supabase.
 */
export const syncOfflineData = async () => {
  if (!navigator.onLine) {
    console.log('[OfflineSync] Intento de sincronización cancelado: el dispositivo sigue sin conexión.');
    return;
  }

  console.log('[OfflineSync] Dispositivo en línea. Iniciando sincronización de datos pendientes...');

  // 1. Sincronizar Alertas de Pánico
  try {
    const alertsQueue = (await offlineStore.getItem(ALERTS_QUEUE_KEY)) || [];
    if (alertsQueue.length > 0) {
      console.log(`[OfflineSync] Sincronizando ${alertsQueue.length} alertas de pánico...`);
      
      for (const alert of alertsQueue) {
        const { error } = await supabase.from('alertas').insert([{
          id_paciente: alert.id_paciente,
          ubicacion: alert.ubicacion,
          fecha: alert.fecha
        }]);

        if (error) throw error;
      }
      
      // Limpiar cola de alertas
      await offlineStore.setItem(ALERTS_QUEUE_KEY, []);
      console.log('[OfflineSync] Alertas de pánico sincronizadas exitosamente.');
    }
  } catch (error) {
    console.error('[OfflineSync] Error al sincronizar alertas de pánico:', error);
  }

  // 2. Sincronizar Mensajes de Chat
  try {
    const messagesQueue = (await offlineStore.getItem(MESSAGES_QUEUE_KEY)) || [];
    if (messagesQueue.length > 0) {
      console.log(`[OfflineSync] Sincronizando ${messagesQueue.length} mensajes de chat...`);

      for (const msg of messagesQueue) {
        const { error } = await supabase.from('mensajes').insert([{
          emisor_id: msg.emisor_id,
          receptor_id: msg.receptor_id,
          mensaje: msg.mensaje,
          fecha: msg.fecha,
          tipo: msg.tipo
        }]);

        if (error) throw error;
      }

      // Limpiar cola de mensajes
      await offlineStore.setItem(MESSAGES_QUEUE_KEY, []);
      console.log('[OfflineSync] Mensajes de chat sincronizados exitosamente.');
    }
  } catch (error) {
    console.error('[OfflineSync] Error al sincronizar mensajes de chat:', error);
  }
};

// Configurar los Listeners de conectividad globales
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOfflineData();
  });
  
  // Realizar un intento de sincronización al cargar la aplicación si hay internet
  window.addEventListener('load', () => {
    if (navigator.onLine) {
      syncOfflineData();
    }
  });
}
