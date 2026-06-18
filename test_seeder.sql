-- SCRIPT DE SEEDER PARA PRUEBAS (test_seeder.sql)
-- Ejecuta este script en el editor SQL de Supabase o mediante la API de base de datos para poblar con 3 usuarios de prueba.

-- 1. Habilitar extensión pgcrypto para hashing si no está habilitada
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Limpiar registros de prueba anteriores para evitar duplicados
DELETE FROM auth.users WHERE email IN ('test_padre@dino.com', 'test_paciente@dino.com', 'test_terapeuta@dino.com');

-- 3. Insertar Padre/Tutor de prueba
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
    '11111111-1111-1111-1111-aaaa11111111',
    'authenticated',
    'authenticated',
    'test_padre@dino.com',
    crypt('dino1234', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"rol": "padre", "telefono": "55-9876-5432", "direccion": "Avenida del Meteorito 456"}',
    NOW(),
    NOW()
);

-- 4. Insertar Paciente (TEA) de prueba
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
    '22222222-2222-2222-2222-bbbb22222222',
    'authenticated',
    'authenticated',
    'test_paciente@dino.com',
    crypt('dino1234', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"rol": "paciente", "etapa_vida": "13-18", "nivel_comunicacion": "Intermedio"}',
    NOW(),
    NOW()
);

-- 5. Insertar Terapeuta de prueba
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
    '33333333-3333-3333-3333-cccc33333333',
    'authenticated',
    'authenticated',
    'test_terapeuta@dino.com',
    crypt('dino1234', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"rol": "terapeuta", "especialidad": "Terapeuta Ocupacional", "cedula": "CED-998877"}',
    NOW(),
    NOW()
);

-- 6. Insertar Vinculaciones Clínicas y Familiares entre los nuevos usuarios de prueba
INSERT INTO public.padres_pacientes (id_padre, id_paciente)
VALUES ('11111111-1111-1111-1111-aaaa11111111', '22222222-2222-2222-2222-bbbb22222222');

INSERT INTO public.terapeutas_pacientes (id_terapeuta, id_paciente)
VALUES ('33333333-3333-3333-3333-cccc33333333', '22222222-2222-2222-2222-bbbb22222222');

-- 7. Insertar Expediente inicial para el paciente de prueba
INSERT INTO public.expedientes (id_paciente, id_terapeuta, diagnostico, notas, avance)
VALUES (
    '22222222-2222-2222-2222-bbbb22222222',
    '33333333-3333-3333-3333-cccc33333333',
    'Trastorno del Espectro Autista (Nivel 2)',
    'Paciente de prueba con etapa de vida 13-18 años. Excelente progreso en interacción táctil.',
    'Estable'
);
