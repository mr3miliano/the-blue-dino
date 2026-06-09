import { createClient } from '@supabase/supabase-js';

// Obtener las credenciales desde las variables de entorno de Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Faltan las credenciales de Supabase en las variables de entorno. ' +
    'Copia .env.example a .env y completa las credenciales.'
  );
}

// Inicializar el cliente. Usamos fallbacks para evitar errores fatales en tiempo de compilación.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
