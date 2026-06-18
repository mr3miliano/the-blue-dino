# Exploración Inicial - The Blue Dino

## 1. Estructura de Directorios y Archivos Existentes

La estructura del proyecto en `c:\Users\emili\OneDrive\Escritorio\the blue dino` es la siguiente:

- **Raíz del proyecto:**
  - `.env` — Variables de entorno configuradas con la URL y clave anónima de Supabase.
  - `.env.example` — Plantilla de configuración de variables de entorno.
  - `.gitignore` — Archivo para ignorar dependencias y variables de entorno en control de versiones.
  - `eslint.config.js` — Configuración del linter ESLint.
  - `gemini.md` — Reglas y especificaciones del proyecto.
  - `index.html` — Punto de entrada del frontend React en la web.
  - `package.json` y `package-lock.json` — Definición de scripts, dependencias y árbol de paquetes.
  - `schema.sql` — Esquema de base de datos PostgreSQL/Supabase (incluye enums, tablas, triggers y políticas RLS).
  - `seeder.sql` — Datos de prueba (padre, paciente, terapeuta, relaciones, mensajes y expedientes).
  - `vite.config.js` — Configuración de Vite con soporte para React.

- **Directorio `src/` (Código Fuente Frontend):**
  - `App.css` y `index.css` — Estilos de la aplicación.
  - `App.jsx` — Enrutador de React con rutas protegidas (`ProtectedRoute`) según el rol del usuario (`padre`, `paciente`, `terapeuta`).
  - `main.jsx` — Punto de entrada principal para renderizado de React.
  - **`assets/`**: Contiene archivos de imagen y logos (`hero.png`, `react.svg`, `vite.svg`).
  - **`store/`**:
    - `AppContext.jsx` — Estado global con contexto de autenticación, perfiles del usuario, monitorización de conexión offline/online y carga global.
  - **`services/`**:
    - `arasaac.js` — Conectividad con la API pública de ARASAAC con caché local en localforage (IndexedDB).
    - `firebase.js` — Simulación y soporte inicial de Firebase Cloud Messaging para notificaciones de chat y botón de pánico.
    - `googleVoice.js` — APIs de voz: Web Speech API (nativa fallback) para TTS (Text-to-Speech) y STT (Speech-to-Text).
    - `offlineSync.js` — Cola local de sincronización automática para alertas de pánico y mensajes pendientes cuando el dispositivo vuelve a estar en línea.
    - `supabase.js` — Cliente de Supabase inicializado con variables de entorno.
  - **`pages/`**:
    - **`auth/`**: `Splash.jsx` (pantalla inicial), `Login.jsx` (inicio de sesión), `Register.jsx` (registro con selección de rol e inputs adicionales correspondientes).
    - **`paciente/`**: `PacienteDashboard.jsx` (tablero de comunicación con pictogramas, niveles de complejidad, botón de pánico y chat).
    - **`padre/`**: `PadreDashboard.jsx` (vinculación de hijos y terapeutas, traductor texto a pictograma, chat y anotaciones en el expediente).
    - **`terapeuta/`**: `TerapeutaDashboard.jsx` (supervisión de pacientes asignados, historial de alertas, y redacción de expedientes clínicos).

- **Directorio `supabase/`:**
  - `config.toml` — Configuración del CLI de Supabase.
  - `migrations/20260602000000_init.sql` — Migración inicial idéntica a `schema.sql`.

---

## 2. Estado de la Compilación (Build)

Se ejecutó el comando de compilación de Vite en el entorno de desarrollo mediante:
```powershell
npm run build
```

**Resultado:**
La compilación se completó de manera exitosa sin errores:
- **Index HTML:** `dist/index.html` (0.79 kB)
- **Estilos CSS:** `dist/assets/index-DYv67bXW.css` (5.99 kB)
- **JavaScript Bundle:** `dist/assets/index-BSQhLDb6.js` (571.30 kB)
- **Tiempo de compilación:** 4.24 segundos.
- **Advertencias:** Rolldown reportó que algunos fragmentos (chunks) superan los 500 kB después de la minificación, sugiriendo el uso de división de código (code-splitting) o imports dinámicos en un entorno productivo real.

---

## 3. Estado de la Implementación del Stack Tecnológico

El análisis de los archivos existentes confirma que el proyecto cuenta con el esqueleto completo y funcional del stack tecnológico solicitado:
- **Base de datos:** `schema.sql` y `seeder.sql` están diseñados al 100% de acuerdo con las especificaciones del rol, tablas y relaciones requeridas.
- **Frontend:** Implementado con React, utilizando hooks de contexto (`AppContext.jsx`) y routing integrado con `@supabase/supabase-js`.
- **Offline:** La integración con `localforage` en `arasaac.js` y `offlineSync.js` está configurada para colas de sincronización locales y persistencia local de pictogramas.
- **Voz y Notificaciones:** Servicios modularizados con soporte local y fallback nativo para desarrollo.
