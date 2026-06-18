# TEST_INFRA — Plan de Pruebas de Caja Negra E2E

Este documento detalla el plan de pruebas de extremo a extremo (E2E) y de caja negra para **The Blue Dino**. Las pruebas están diseñadas en cuatro niveles de cobertura para garantizar la estabilidad y funcionalidad en los flujos críticos de la aplicación.

---

## TIER 1: Cobertura de Funcionalidades (Feature Coverage)

### 1.1 Autenticación y Pantalla de Carga (Splash Screen)
*   **Caso de Prueba 1.1.1 (Splash Screen):** Verificar que al abrir la aplicación, el Splash Screen detecta si hay una sesión activa y redirige automáticamente al dashboard del rol correspondiente (Padre, Paciente, Terapeuta).
*   **Caso de Prueba 1.1.2 (Registro de Usuarios):** Registrar un nuevo usuario con Supabase Auth seleccionando un rol específico. Comprobar que se crea el perfil en la base de datos con el rol correcto y sus datos vinculados.
*   **Caso de Prueba 1.1.3 (Inicio de Sesión):** Validar el login con credenciales correctas e incorrectas, confirmando los mensajes de error informativos.

### 1.2 Dashboard del Padre/Tutor
*   **Caso de Prueba 1.2.1 (Vincular Paciente):** Confirmar que el padre puede vincular a un paciente ingresando su correo electrónico.
*   **Caso de Prueba 1.2.2 (Vincular Terapeuta):** Confirmar que el padre puede asignar un terapeuta registrado a su hijo para que supervise su progreso.
*   **Caso de Prueba 1.2.3 (Chat en Tiempo Real):** Enviar un mensaje desde el panel del padre y confirmar que se muestra instantáneamente en el panel del hijo mediante Supabase Realtime.

### 1.3 Dashboard del Paciente TEA
*   **Caso de Prueba 1.3.1 (Adaptación por Etapa de Vida - 6-12 años):** Iniciar sesión con un paciente de 6-12 años y confirmar que el tablero de pictogramas muestra vocabulario básico agrupado en Personas, Acciones, Cosas y Comida.
*   **Caso de Prueba 1.3.2 (Adaptación por Etapa de Vida - 13-18 años):** Iniciar sesión con un paciente de 13-18 años y confirmar el enfoque de interacción social y comunicación extendida.
*   **Caso de Prueba 1.3.3 (Adaptación por Etapa de Vida - 18-25 años):** Iniciar sesión con un paciente de 18-25 años enfocado en independencia y tareas de vida diaria.

### 1.4 Motor de Comunicación Visual
*   **Caso de Prueba 1.4.1 (Búsqueda en ARASAAC):** Escribir una palabra y verificar que el motor busca y descarga el pictograma correspondiente de la API oficial de ARASAAC, clasificando su borde por categoría semántica.
*   **Caso de Prueba 1.4.2 (Salida de Voz - Text-to-Speech):** Al seleccionar una combinación de pictogramas, verificar que la aplicación reproduce el audio sincronizado con la frase estructurada.

### 1.5 Dashboard del Terapeuta
*   **Caso de Prueba 1.5.1 (Lista de Pacientes):** Validar que el terapeuta ve la lista de pacientes asignados a su cargo.
*   **Caso de Prueba 1.5.2 (Registrar Avances):** Crear un reporte clínico (diagnóstico, notas, nivel de avance) y guardarlo en el expediente histórico del paciente.

---

## TIER 2: Casos Límite y de Frontera (Boundary & Corner Cases)

### 2.1 Restricciones de Vinculación de Pacientes
*   **Caso de Prueba 2.1.1 (Límite de Pacientes por Padre):** Intentar registrar un 4to paciente a un Padre. Validar que la interfaz o el backend previene la operación de vinculación (Límite: 1 a 3 pacientes por padre).
*   **Caso de Prueba 2.1.2 (Límite de Padres por Paciente):** Intentar vincular un 3er Padre a un Paciente. Validar que el sistema lo rechaza (Límite: máximo 2 padres por paciente).

### 2.2 Botón de Pánico y Cancelación
*   **Caso de Prueba 2.2.1 (Interrupción de Cuenta Regresiva):** Presionar el botón de pánico, esperar a que comience la cuenta regresiva de 3 segundos y presionar "Cancelar". Confirmar que no se envía ninguna alerta ni notificación Push.
*   **Caso de Prueba 2.2.2 (Confirmación de Envío):** Permitir que la cuenta regresiva llegue a 0. Verificar que se dispara el envío de la ubicación GPS y la notificación FCM.

---

## TIER 3: Combinaciones de Funcionalidades (Cross-Feature Combinations)

### 3.1 Pánico Offline + Recuperación y Envío FCM
*   **Caso de Prueba 3.1.1:** Simular la desconexión del dispositivo (offline) y activar el botón de pánico en el panel del Paciente.
*   **Resultado Esperado:** 
    1. La alerta de pánico se encola localmente en `localforage`.
    2. La interfaz muestra un indicador offline.
    3. Al recuperar la conectividad, la cola se procesa automáticamente, sube la alerta a la tabla `ALERTAS` de Supabase y dispara las notificaciones Push vía FCM al padre y al terapeuta asignado con la ubicación GPS exacta.

### 3.2 Dictado de Voz a Pictograma + Audio Fallback
*   **Caso de Prueba 3.2.1:** Simular la entrada de voz del paciente diciendo "yo quiero manzana comer".
*   **Resultado Esperado:** El motor Speech-to-Text convierte el audio a texto, el motor semántico lo clasifica, consulta los pictogramas en caché local o ARASAAC, arma la tira de imágenes en pantalla en orden gramatical y reproduce el audio correspondiente usando la Web Speech API como fallback offline si Google TTS no responde.

---

## TIER 4: Escenarios del Mundo Real (Real-World Scenarios)

### 4.1 Ciclo de Intervención Terapeuta-Padre-Paciente
*   **Escenario:**
    1. Un terapeuta inicia sesión y vincula a un nuevo paciente mediante su correo electrónico.
    2. Registra un diagnóstico inicial y establece su nivel de comunicación en "Intermedio".
    3. El padre inicia sesión, ve las notas de actualización y las alertas del paciente.
    4. El paciente inicia sesión; el tablero se adapta dinámicamente al nivel "Intermedio" mostrando pestañas de síntomas y emociones recomendadas por el terapeuta.
    5. El paciente envía un pictograma de dolor "Me duele el estómago" por el chat. El padre recibe una notificación instantánea y responde por el chat de Supabase Realtime.

---

## INSTRUCCIONES DE EJECUCIÓN AUTOMATIZADA

Para ejecutar la verificación automatizada de estas reglas de negocio y flujos de datos sin necesidad de una interfaz gráfica (Headless), ejecuta el siguiente script desde la terminal:

```powershell
node run_tests.js
```
