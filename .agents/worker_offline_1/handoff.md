# Auditoría de Sincronización Offline y Notificaciones Push

## 1. Mapeo y Flujo de la Cola Offline (`offlineSync.js`)
El servicio `offlineSync.js` utiliza la librería `localforage` para gestionar dos colas locales:
- `pending_panic_alerts` (cola de alertas de pánico)
- `pending_chat_messages` (cola de mensajes de chat)

### Funciones de la Cola:
- **`queuePanicAlert(alertData)`**: Agrega una alerta a `pending_panic_alerts` con un identificador temporal `id_temp` y fecha ISO actual.
- **`queueMessage(msgData)`**: Agrega un mensaje a `pending_chat_messages` con un identificador temporal `id_temp` y fecha ISO actual, retornando el mensaje estructurado para actualización inmediata en UI.
- **`syncOfflineData()`**: Procesa y vacía de forma secuencial ambas colas enviando los registros a Supabase (`alertas` y `mensajes` respectivamente) si el dispositivo está online (`navigator.onLine`). Al completarse, limpia las colas asignando un arreglo vacío `[]` a las claves correspondientes.

## 2. Disparadores de Conectividad (Online/Offline)
El navegador detecta la transición de red mediante listeners globales en `window`:
```javascript
window.addEventListener('online', () => {
  syncOfflineData();
});

window.addEventListener('load', () => {
  if (navigator.onLine) {
    syncOfflineData();
  }
});
```
- Cuando el navegador pasa a estar `online`, el manejador invoca a `syncOfflineData()`, el cual sincroniza las colas de alertas y de mensajes de chat pendientes acumulados de manera asíncrona.
- Al cargar la aplicación (`load`), si hay conexión, se ejecuta un intento de sincronización preventivo para procesar datos pendientes de sesiones previas.
- El estado global de conexión se expone en la UI a través del `AppContext.jsx` mediante el estado `isOffline` (inicializado con `!navigator.onLine`), actualizándose en tiempo real mediante listeners para mostrar banners informativos de advertencia.

## 3. Simulación y Mock de Notificaciones Push (FCM) (`firebase.js`)
El servicio `firebase.js` implementa un simulador mediante `MockNotificationManager` que gestiona las alertas de pánico y notificaciones de chat locales:
- **`requestPermission()`**: Solicita permisos nativos de notificación en el navegador (`Notification.requestPermission()`).
- **`triggerNotification(title, body, data)`**:
  - Imprime un log estilizado en la consola (con fondo rojo para pánico).
  - Llama a todos los listeners registrados en la UI (enviando el evento `{ title, body, data }`).
  - Muestra una notificación nativa del navegador usando la API de Notificaciones (`new Notification`) si los permisos están concedidos.
- **`sendPanicNotification(pacienteNombre, ubicacion)`**: Genera y propaga una notificación de pánico con el título `🚨 BOTÓN DE PÁNICO: [Nombre]` y el contenido de ubicación.
- **`sendMessageNotification(emisorNombre, mensajeContenido)`**: Genera y propaga una notificación de chat con el contenido del mensaje (recortado a 30 caracteres si excede el límite).

## 4. Auditoría de Integración en Dashboards
### Dashboard del Paciente (`PacienteDashboard.jsx`):
- **Botón de pánico**: En caso de estar offline, `savePanicAlert` almacena la alerta llamando a `queuePanicAlert` en el almacén local. Si está online, realiza la inserción en la base de datos Supabase e invoca a `sendPanicNotification` para simular la notificación FCM correspondiente.
- **Envío de mensajes (chat y plantillas)**: Si `isOffline` es verdadero, los mensajes se envían a la cola con `queueMessage` y se añaden al estado local `chatMessages` para respuesta inmediata. Si está online, se guardan en la base de datos Supabase.

### Dashboard del Padre (`PadreDashboard.jsx`):
- **Envío de mensajes**: Igualmente hooks a `queueMessage` si está offline y a Supabase si está online.
- **Notificaciones**: Al recibir un mensaje del hijo en tiempo real (por la suscripción a Supabase Realtime), se dispara `sendMessageNotification` para avisar al padre mediante la simulación de push.

## 5. Estado del Build
Se ejecutó con éxito `npm run build` sin errores de compilación o lint.
```bash
vite v8.0.16 building client environment for production...
✓ built in 1.17s
dist/index.html                   0.79 kB
dist/assets/index-DYv67bXW.css    5.99 kB
dist/assets/index-BjtwTWZK.js   572.95 kB
```
No se detectaron bugs o inconsistencias de lógica en la integración de colas o sincronizadores.
