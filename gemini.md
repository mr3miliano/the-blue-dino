Eres un arquitecto de software y desarrollador fullstack experto. 
Tu tarea es desarrollar una aplicación llamada [NOMBRE DEL PROYECTO] 
orientada a personas con Trastorno del Espectro Autista (TEA), 
sus padres/tutores y sus terapeutas.

---

## STACK TECNOLÓGICO

- Frontend/Web admin: React (Vite)
- Empaquetado móvil: Tauri (para Android e iOS)
- Backend y base de datos: Supabase (PostgreSQL + Auth + Realtime + Storage)
- Notificaciones push: Firebase Cloud Messaging (FCM)
- Motor de voz: Google Cloud Text-to-Speech y Speech-to-Text API
- Pictogramas: ARASAAC (API pública gratuita)
- Idioma de la interfaz: Español únicamente
- Soporte offline: obligatorio en funciones críticas 
  (pictogramas, motor de comunicación, botón de pánico)

---

## BASE DE DATOS (Supabase/PostgreSQL)

Diseña y genera los scripts SQL para las siguientes tablas:

- USUARIOS: id_usuario (PK), correo, password, rol 
  (enum: 'padre', 'paciente', 'terapeuta')
- PACIENTES: id_paciente (PK), id_usuario (FK), 
  etapa_vida (enum: '6-12', '13-18', '18-25'), 
  nivel_comunicacion (string)
- PADRES: id_padre (PK), id_usuario (FK), telefono, direccion
- TERAPEUTAS: id_terapeuta (PK), id_usuario (FK), 
  especialidad, cedula
- EXPEDIENTES: id_expediente (PK), id_paciente (FK), 
  id_terapeuta (FK), diagnostico, notas, avance
- MENSAJES: id_mensaje (PK), emisor_id (FK), 
  receptor_id (FK), mensaje, fecha, tipo
- ALERTAS: id_alerta (PK), id_paciente (FK), 
  ubicacion, fecha
- PICTOGRAMAS: id_pictograma (PK), categoria, texto, imagen

Relaciones:
- Un Padre puede tener entre 1 y 3 pacientes registrados
- Un Paciente puede tener 1 o 2 padres y 1 o muchos terapeutas
- Un Terapeuta puede tener 1 o muchos pacientes

---

## ARQUITECTURA DE MÓDULOS

Organiza el proyecto en los siguientes módulos principales:

### 1. AUTENTICACIÓN
- Splash Screen → detectar si el usuario ya está registrado
- Login y Registro con Supabase Auth
- Configuración inicial de rol al registrarse 
  (Padre/Tutor, Paciente TEA, Terapeuta)
- Redirección al dashboard correspondiente según rol

---

### 2. DASHBOARD PADRE/TUTOR
Funcionalidades:
- Vincular paciente (seleccionar paciente existente)
- Vincular terapeuta (asignar terapeuta al paciente)
- Motor texto → pictograma 
  (el padre escribe y se generan pictogramas para el hijo)
- Chat en tiempo real con el hijo (Supabase Realtime)
- Ver expediente del paciente
- Agregar notaciones/notas sobre el paciente

---

### 3. DASHBOARD PACIENTE TEA
Funcionalidades:
- Motor de comunicación visual (texto → pictograma, 
  texto → voz, voz → texto) usando Google Cloud APIs 
  y ARASAAC
- El motor debe adaptarse a la etapa de vida del paciente:
    * 6-12 años: categorías de Personas, Acciones, 
      Cosas y Comida con pictogramas básicos. 
      El padre puede configurar pictogramas específicos 
      de alimentación.
    * 13-18 años: enfocado en desarrollo social, 
      expresión de gustos y comunicación constante.
    * 18-25 años: orientado a independencia y 
      funcionalidad como adulto en la vida diaria.
- Chat en tiempo real con padre o tutor
- Botón de pánico:
    * Al presionarlo solicita confirmación
    * Genera alerta con ubicación GPS
    * Notifica via FCM al padre Y al terapeuta
    * Registra el evento en la tabla ALERTAS

---

### 4. DASHBOARD TERAPEUTA
Funcionalidades:
- Ver lista de pacientes asignados
- Ver expediente de cada paciente
- Cargar/actualizar expediente (diagnóstico, notas, avance)
- Administrar pacientes (CRUD completo)
- Registrar avances del paciente

---

### 5. MOTOR DE COMUNICACIÓN
Flujo interno del motor:
1. El usuario ingresa texto o voz
2. Si es voz → Google Speech-to-Text lo convierte a texto
3. El texto pasa por un motor semántico que clasifica 
   la intención en categorías: 
   Personas / Acciones / Objetos / Comida
4. Se buscan los pictogramas correspondientes en ARASAAC
5. Se construye la respuesta visual (pictogramas + texto)
6. Google Text-to-Speech genera el audio de salida
7. Se muestra al usuario: imagen + texto + voz simultáneamente

Vocabulario base para etapa 6-12:
- Personas: yo, tú, él, ella, papá, mamá, ellos, ellas, 
  hermano, hermana, nosotros, ustedes, abuelo, abuela
- Acciones: querer, jugar, comer, dormir, ir, hacer, bañarse
- Cosas: juguete, baño, casa, parque, vaso, plato, 
  tv, pelota, agua, jugo
- Comida: configurable por el padre con pictogramas 
  específicos de ARASAAC

---

### 6. SOPORTE OFFLINE
Las siguientes funciones deben operar sin conexión a internet:
- Motor de pictogramas (caché local de ARASAAC)
- Botón de pánico (guardar alerta localmente y 
  sincronizar al recuperar conexión)
- Motor de voz básico (usar Web Speech API del navegador 
  como fallback cuando Google API no esté disponible)
- Sincronización automática con Supabase al 
  recuperar conectividad

---

### 7. NOTIFICACIONES (Firebase FCM)
- Configurar FCM para envío de notificaciones push
- Disparar notificación al padre y terapeuta 
  cuando el paciente activa el botón de pánico
- Notificaciones de nuevos mensajes en el chat
- La notificación de pánico debe incluir 
  la ubicación GPS del paciente

---

## ESTRUCTURA DE CARPETAS SUGERIDA


/src
/assets
/components
/common
/padre
/paciente
/terapeuta
/pages
/auth
/padre
/paciente
/terapeuta
/hooks
/services
/supabase.js
/googleVoice.js
/arasaac.js
/firebase.js
/offlineSync.js
/store (estado global)
/utils
/src-tauri (configuración Tauri para móvil)


---

## INSTRUCCIONES PARA EL AGENTE

1. Comienza generando el esquema SQL completo de la base 
   de datos con todas las relaciones y constraints.
2. Luego genera la estructura base del proyecto React + Tauri.
3. Desarrolla módulo por módulo en este orden:
   Auth → Dashboard Padre → Motor de Comunicación → 
   Dashboard Paciente → Dashboard Terapeuta → 
   Botón de Pánico → Offline Sync → Notificaciones FCM
4. Para cada módulo entrega:
   - Componentes React
   - Servicios/hooks correspondientes
   - Integración con Supabase
   - Manejo de errores y estados de carga
5. El diseño debe ser accesible, con elementos grandes, 
   colores claros y navegación simple, 
   pensado para usuarios con TEA.
6. Incluye comentarios en el código en español.
7. Al finalizar cada módulo, indica qué sigue 
   y qué dependencias necesita instalar el equipo.