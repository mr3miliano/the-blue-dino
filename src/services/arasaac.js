/**
 * SERVICIO ARASAAC (arasaac.js)
 * Conexión con la API pública de ARASAAC para buscar y obtener pictogramas.
 * Implementa almacenamiento local (caché) con localforage (IndexedDB) para soporte offline.
 */

import localforage from 'localforage';

// Configurar el almacén de localforage para los pictogramas
const pictoStore = localforage.createInstance({
  name: 'the-blue-dino',
  storeName: 'arasaac-pictograms-cache'
});

const BASE_API_URL = 'https://api.arasaac.org/api/pictograms/es/search';
const BASE_IMAGE_URL = 'https://api.arasaac.org/v1/pictograms';

// Vocabulario base local para etapa 6-12 (usado como fallback offline si no está cacheado)
const FALLBACK_VOCABULARY = {
  // Personas
  'yo': 6625, 'tú': 6626, 'él': 6627, 'ella': 6628, 'papá': 33177, 'mamá': 33176,
  'ellos': 6629, 'ellas': 6630, 'hermano': 6229, 'hermana': 6230, 'nosotros': 6631,
  'ustedes': 6632, 'abuelo': 6358, 'abuela': 6357,
  // Acciones
  'querer': 10565, 'jugar': 6147, 'comer': 6112, 'dormir': 6128, 'ir': 10567,
  'hacer': 9318, 'bañarse': 6251,
  // Cosas
  'juguete': 7761, 'baño': 25520, 'casa': 2479, 'parque': 2822, 'vaso': 7091,
  'plato': 7088, 'tv': 7291, 'pelota': 7731, 'agua': 9593, 'jugo': 7076,
  // Comida básica
  'comida': 2486, 'pan': 7026, 'manzana': 2399, 'plátano': 2409, 'leche': 7048
};

/**
 * Busca pictogramas por un término de texto en español.
 * @param {string} term Término a buscar (ej: "comer").
 * @returns {Promise<Array>} Lista de pictogramas con sus URLs e IDs.
 */
export const searchPictograms = async (term) => {
  if (!term) return [];
  const cleanTerm = term.trim().toLowerCase();

  try {
    // 1. Intentar obtener de la caché local primero
    const cachedData = await pictoStore.getItem(cleanTerm);
    if (cachedData) {
      console.log(`[ARASAAC] Resultados obtenidos de la caché local para: "${cleanTerm}"`);
      return cachedData;
    }

    // Si estamos offline y no hay caché, usar fallback
    if (!navigator.onLine) {
      return getFallbackPictogram(cleanTerm);
    }

    // 2. Si hay internet y no está en caché, buscar en la API oficial
    console.log(`[ARASAAC] Buscando en API de ARASAAC para: "${cleanTerm}"`);
    const response = await fetch(`${BASE_API_URL}/${encodeURIComponent(cleanTerm)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return getFallbackPictogram(cleanTerm);
      }
      throw new Error(`Error en la consulta de ARASAAC: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Mapear los resultados a un formato simple e incluir la URL de la imagen
    const mappedResults = data.map(item => ({
      id: item._id,
      texto: cleanTerm,
      imagen: `${BASE_IMAGE_URL}/${item._id}`,
      categoria: resolveCategory(cleanTerm)
    }));

    // 3. Guardar en la caché local para futuras consultas offline
    if (mappedResults.length > 0) {
      await pictoStore.setItem(cleanTerm, mappedResults);
    }

    return mappedResults;
  } catch (error) {
    console.error(`Error buscando pictograma para "${cleanTerm}":`, error);
    // Intentar fallback si falla la API (por ejemplo por CORS o Red)
    return getFallbackPictogram(cleanTerm);
  }
};

/**
 * Obtiene un pictograma fallback local offline si no hay conexión y no está en caché.
 */
const getFallbackPictogram = (term) => {
  const id = FALLBACK_VOCABULARY[term];
  if (id) {
    const result = [{
      id: id,
      texto: term,
      imagen: `${BASE_IMAGE_URL}/${id}`,
      categoria: resolveCategory(term)
    }];
    console.log(`[ARASAAC] Fallback local encontrado para "${term}": ID ${id}`);
    return result;
  }
  return [];
};

/**
 * Clasifica de forma básica un término en una categoría (personas, acciones, cosas, comida)
 * para colorear los bordes de los pictogramas (Regla del motor semántico).
 */
export const resolveCategory = (term) => {
  const personas = ['yo', 'tú', 'él', 'ella', 'papá', 'mamá', 'ellos', 'ellas', 'hermano', 'hermana', 'nosotros', 'ustedes', 'abuelo', 'abuela', 'hijo', 'hija', 'tío', 'tía', 'terapeuta', 'maestro', 'maestra', 'niño', 'niña'];
  const acciones = ['querer', 'jugar', 'comer', 'dormir', 'ir', 'hacer', 'bañarse', 'ver', 'oir', 'cantar', 'bailar', 'pintar', 'escribir', 'leer', 'comprar', 'salir', 'entrar', 'ayudar', 'necesitar', 'gustar', 'dolor'];
  const cosas = ['juguete', 'baño', 'casa', 'parque', 'vaso', 'plato', 'tv', 'pelota', 'agua', 'jugo', 'celular', 'tablet', 'ropa', 'cama', 'silla', 'mesa', 'puerta', 'ventana', 'libro', 'lápiz', 'mochila'];
  const comida = ['comida', 'pan', 'manzana', 'plátano', 'leche', 'galleta', 'fruta', 'verdura', 'carne', 'pollo', 'sopa', 'arroz', 'huevo', 'queso', 'yogur', 'chocolate', 'dulce', 'agua', 'jugo'];

  const clean = term.toLowerCase().trim();
  
  if (personas.includes(clean)) return 'personas';
  if (acciones.includes(clean)) return 'acciones';
  if (comida.includes(clean)) return 'comida';
  if (cosas.includes(clean)) return 'cosas';
  
  // Categoría por defecto si no coincide con el vocabulario base
  return 'cosas';
};
