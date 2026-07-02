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

async function check() {
  const accounts = [
    { email: "padre@dino.com", pass: "dino1234" },
    { email: "test_padre@dino.com", pass: "dino1234" }
  ];

  for (const acc of accounts) {
    console.log(`Intentando login con: ${acc.email}...`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: acc.email,
      password: acc.pass
    });
    if (error) {
      console.log(`  [-] Falló: ${error.message} (${error.status})`);
    } else {
      console.log(`  [+] ¡Exitoso! ID: ${data.user.id}`);
    }
  }
}

check();
