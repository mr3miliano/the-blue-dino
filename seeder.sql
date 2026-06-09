-- SCRIPT DE SEEDER PARA THE BLUE DINO
-- Ejecuta este script en el editor SQL de Supabase para poblar tu base de datos con datos de prueba pre-vinculados.

-- 1. Habilitar extensión pgcrypto para hashing de contraseñas si no está habilitada
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Limpiar registros de prueba anteriores si existen (en orden inverso de dependencia)
DELETE FROM auth.users WHERE email IN ('padre@dino.com', 'paciente@dino.com', 'terapeuta@dino.com');

-- 3. INSERTAR USUARIOS EN TABLA DE AUTENTICACIÓN (auth.users)
-- Contraseña común para los 3 usuarios: "dino1234"
-- El trigger on_auth_user_created poblará de forma automática las tablas de perfiles públicos.

-- Padre / Tutor
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'padre@dino.com',
    crypt('dino1234', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"rol": "padre", "telefono": "55-1234-5678", "direccion": "Calle de los Dinosaurios 123"}',
    NOW(),
    NOW()
);

-- Paciente (TEA)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'paciente@dino.com',
    crypt('dino1234', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"rol": "paciente", "etapa_vida": "6-12", "nivel_comunicacion": "Básico"}',
    NOW(),
    NOW()
);

-- Terapeuta
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated',
    'authenticated',
    'terapeuta@dino.com',
    crypt('dino1234', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"rol": "terapeuta", "especialidad": "Psicóloga Infantil especialista en TEA", "cedula": "CED-123456"}',
    NOW(),
    NOW()
);

-- 4. INSERTAR VINCULACIONES FAMILIARES Y CLÍNICAS (Muchos a Muchos)
-- Relación Padre - Paciente
INSERT INTO public.padres_pacientes (id_padre, id_paciente)
VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- Relación Terapeuta - Paciente
INSERT INTO public.terapeutas_pacientes (id_terapeuta, id_paciente)
VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222');

-- 5. SEMBRAR EXPEDIENTES / NOTAS CLÍNICAS
INSERT INTO public.expedientes (id_paciente, id_terapeuta, diagnostico, notas, avance)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    'TEA Grado 1 (Leve)',
    'El paciente muestra excelente respuesta visual a las secuencias de pictogramas. Se recomienda fomentar el uso de frases de 3 palabras en casa.',
    'Mejorando'
);

-- 6. SEMBRAR MENSAJES DE CHAT INICIALES
-- El padre saluda
INSERT INTO public.mensajes (emisor_id, receptor_id, mensaje, tipo)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'hola hijo como estas',
    'texto'
);

-- El hijo responde con pictogramas (yo querer jugar pelota)
INSERT INTO public.mensajes (emisor_id, receptor_id, mensaje, tipo)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'yo querer jugar pelota',
    'pictograma'
);
