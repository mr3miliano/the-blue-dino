import { resolveCategory } from './src/services/arasaac.js';

// Mock de localStorage/localforage simplificado para entornos Node
const mockOfflineStore = {
  store: {},
  async getItem(key) {
    return this.store[key] || null;
  },
  async setItem(key, value) {
    this.store[key] = value;
    return value;
  }
};

// --- CONFIGURACIÓN DE COLAS OFFLINE SIMULADAS ---
async function queuePanicAlert(alertData) {
  const queue = (await mockOfflineStore.getItem('pending_panic_alerts')) || [];
  const newAlert = {
    ...alertData,
    id_temp: 'temp-uuid-123456789',
    fecha: new Date().toISOString()
  };
  queue.push(newAlert);
  await mockOfflineStore.setItem('pending_panic_alerts', queue);
  return newAlert;
}

async function queueMessage(msgData) {
  const queue = (await mockOfflineStore.getItem('pending_chat_messages')) || [];
  const newMsg = {
    ...msgData,
    id_temp: 'temp-uuid-987654321',
    fecha: new Date().toISOString()
  };
  queue.push(newMsg);
  await mockOfflineStore.setItem('pending_chat_messages', queue);
  return newMsg;
}

// --- SIMULACIÓN DE VALIDACIONES DE LÍMITES ---
function validateParentPatientRelation(parentPatientsList, newPatientId) {
  // Un Padre puede tener entre 1 y 3 pacientes registrados
  if (parentPatientsList.length >= 3) {
    return { valid: false, error: 'Un Padre no puede tener más de 3 pacientes registrados.' };
  }
  if (parentPatientsList.includes(newPatientId)) {
    return { valid: false, error: 'El paciente ya está vinculado a este padre.' };
  }
  return { valid: true };
}

function validatePatientParentRelation(patientParentsList, newParentId) {
  // Un Paciente puede tener 1 o 2 padres
  if (patientParentsList.length >= 2) {
    return { valid: false, error: 'Un Paciente no puede tener más de 2 padres.' };
  }
  if (patientParentsList.includes(newParentId)) {
    return { valid: false, error: 'El padre ya está vinculado a este paciente.' };
  }
  return { valid: true };
}

// --- EJECUTOR DE PRUEBAS ---
async function runTests() {
  console.log('\x1b[36m==================================================\x1b[0m');
  console.log('\x1b[36m   EJECUTANDO PRUEBAS DE INTEGRIDAD - BLUE DINO   \x1b[0m');
  console.log('\x1b[36m==================================================\x1b[0m');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`\x1b[32m[PASSED]\x1b[0m ${message}`);
      passed++;
    } else {
      console.error(`\x1b[31m[FAILED]\x1b[0m ${message}`);
      failed++;
    }
  }

  // TIER 1 & 3: Pruebas del Motor de Clasificación Semántica (arasaac.js)
  try {
    assert(resolveCategory('yo') === 'personas', 'Clasificación de "yo" debe ser "personas"');
    assert(resolveCategory('comer') === 'acciones', 'Clasificación de "comer" debe ser "acciones"');
    assert(resolveCategory('manzana') === 'comida', 'Clasificación de "manzana" debe ser "comida"');
    assert(resolveCategory('casa') === 'cosas', 'Clasificación de "casa" debe ser "cosas"');
    assert(resolveCategory('palabra_inexistente') === 'cosas', 'Clasificación por defecto debe ser "cosas"');
  } catch (err) {
    console.error('Error en pruebas de clasificación semántica:', err);
    failed++;
  }

  // TIER 2 & 3: Pruebas de Soporte Offline y Colas de Pánico/Mensajes
  try {
    await mockOfflineStore.setItem('pending_panic_alerts', []);
    await mockOfflineStore.setItem('pending_chat_messages', []);

    const alert = await queuePanicAlert({ id_paciente: 'pac-123', ubicacion: 'GPS: 19.4326,-99.1332' });
    const queueAlerts = await mockOfflineStore.getItem('pending_panic_alerts');
    
    assert(queueAlerts.length === 1, 'La alerta offline de pánico se guardó correctamente');
    assert(queueAlerts[0].id_paciente === 'pac-123', 'El ID del paciente en la alerta offline es correcto');
    assert(queueAlerts[0].ubicacion === 'GPS: 19.4326,-99.1332', 'La ubicación GPS offline se guardó correctamente');

    const msg = await queueMessage({ emisor_id: 'pac-123', receptor_id: 'pad-456', mensaje: 'Hola Papá', tipo: 'texto' });
    const queueMsgs = await mockOfflineStore.getItem('pending_chat_messages');

    assert(queueMsgs.length === 1, 'El mensaje offline de chat se guardó correctamente en la cola');
    assert(queueMsgs[0].mensaje === 'Hola Papá', 'El contenido del mensaje offline es íntegro');
  } catch (err) {
    console.error('Error en pruebas de colas offline:', err);
    failed++;
  }

  // TIER 2: Pruebas de Límites de Relaciones (Reglas de Negocio)
  try {
    // Caso de límite: máximo 3 pacientes por padre
    const currentPatients = ['pac-1', 'pac-2', 'pac-3'];
    const validation1 = validateParentPatientRelation(currentPatients, 'pac-4');
    assert(validation1.valid === false, 'Debe denegar la vinculación de un 4to paciente a un padre');

    const currentPatientsOk = ['pac-1', 'pac-2'];
    const validation2 = validateParentPatientRelation(currentPatientsOk, 'pac-3');
    assert(validation2.valid === true, 'Debe permitir vincular un 3er paciente a un padre');

    // Caso de límite: máximo 2 padres por paciente
    const currentParents = ['pad-1', 'pad-2'];
    const validation3 = validatePatientParentRelation(currentParents, 'pad-3');
    assert(validation3.valid === false, 'Debe denegar la vinculación de un 3er padre a un paciente');
  } catch (err) {
    console.error('Error en pruebas de validación de límites:', err);
    failed++;
  }

  console.log('\x1b[36m--------------------------------------------------\x1b[0m');
  console.log(`RESULTADOS: \x1b[32m${passed} aprobadas\x1b[0m, \x1b[31m${failed} fallidas\x1b[0m`);
  console.log('\x1b[36m==================================================\x1b[0m');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
