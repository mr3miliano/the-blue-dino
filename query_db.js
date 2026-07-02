import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let supabaseUrl = "";
let supabaseAnonKey = "";

try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts[1].trim().replace(/^['"]|['"]$/g, '');
      if (key === 'VITE_SUPABASE_URL') {
        supabaseUrl = val;
      } else if (key === 'VITE_SUPABASE_ANON_KEY') {
        supabaseAnonKey = val;
      }
    }
  }
} catch (e) {
  console.error(e);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDB() {
  console.log("Consultando tabla usuarios...");
  const { data, error } = await supabase.from('usuarios').select('*').limit(5);
  if (error) {
    console.error("Error al consultar public.usuarios:", error);
  } else {
    console.log("Usuarios encontrados:", data);
  }
}

checkDB();
