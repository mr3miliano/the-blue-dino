-- ====================================================
-- 1. ESQUEMA DE BASE DE DATOS (schema.sql)
-- ====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- TIPOS ENUM
CREATE TYPE rol_enum AS ENUM ('padre', 'paciente', 'terapeuta');
CREATE TYPE etapa_vida_enum AS ENUM ('6-12', '13-18', '18-25');

-- TABLA USUARIOS (Vinculada a auth.users de Supabase)
CREATE TABLE public.usuarios (
    id_usuario UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    correo TEXT NOT NULL UNIQUE,
    rol rol_enum NOT NULL,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABLA PADRES
CREATE TABLE public.padres (
    id_padre UUID PRIMARY KEY REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    telefono TEXT,
    direccion TEXT
);

-- TABLA PACIENTES
CREATE TABLE public.pacientes (
    id_paciente UUID PRIMARY KEY REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    etapa_vida etapa_vida_enum NOT NULL,
    nivel_comunicacion TEXT
);

-- TABLA TERAPEUTAS
CREATE TABLE public.terapeutas (
    id_terapeuta UUID PRIMARY KEY REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    especialidad TEXT,
    cedula TEXT
);

-- TABLAS DE RELACIONES (JUNCTION TABLES)
CREATE TABLE public.padres_pacientes (
    id_padre UUID REFERENCES public.padres(id_padre) ON DELETE CASCADE,
    id_paciente UUID REFERENCES public.pacientes(id_paciente) ON DELETE CASCADE,
    PRIMARY KEY (id_padre, id_paciente)
);

CREATE TABLE public.terapeutas_pacientes (
    id_terapeuta UUID REFERENCES public.terapeutas(id_terapeuta) ON DELETE CASCADE,
    id_paciente UUID REFERENCES public.pacientes(id_paciente) ON DELETE CASCADE,
    PRIMARY KEY (id_terapeuta, id_paciente)
);

-- TABLA EXPEDIENTES
CREATE TABLE public.expedientes (
    id_expediente UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_paciente UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE CASCADE,
    id_terapeuta UUID REFERENCES public.terapeutas(id_terapeuta) ON DELETE SET NULL,
    diagnostico TEXT,
    notas TEXT,
    avance TEXT,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABLA MENSAJES (Chat en tiempo real)
CREATE TABLE public.mensajes (
    id_mensaje UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emisor_id UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    receptor_id UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    mensaje TEXT NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    tipo TEXT DEFAULT 'texto' NOT NULL
);

-- TABLA ALERTAS (Botón de pánico)
CREATE TABLE public.alertas (
    id_alerta UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_paciente UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE CASCADE,
    ubicacion TEXT NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABLA PICTOGRAMAS (Caché local/remota)
CREATE TABLE public.pictogramas (
    id_pictograma SERIAL PRIMARY KEY,
    categoria TEXT NOT NULL,
    texto TEXT NOT NULL,
    imagen TEXT NOT NULL
);

-- TRIGGERS Y FUNCIONES PARA SINCRONIZACIÓN DE USUARIOS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_rol public.rol_enum;
BEGIN
    v_rol := COALESCE((new.raw_user_meta_data->>'rol')::public.rol_enum, 'paciente'::public.rol_enum);

    INSERT INTO public.usuarios (id_usuario, correo, rol)
    VALUES (new.id, new.email, v_rol);

    IF v_rol = 'padre' THEN
        INSERT INTO public.padres (id_padre) VALUES (new.id);
    ELSIF v_rol = 'paciente' THEN
        INSERT INTO public.pacientes (id_paciente, etapa_vida, nivel_comunicacion)
        VALUES (
            new.id, 
            COALESCE((new.raw_user_meta_data->>'etapa_vida')::public.etapa_vida_enum, '6-12'::public.etapa_vida_enum),
            COALESCE(new.raw_user_meta_data->>'nivel_comunicacion', 'Básico')
        );
    ELSIF v_rol = 'terapeuta' THEN
        INSERT INTO public.terapeutas (id_terapeuta) VALUES (new.id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CONFIGURACIÓN DE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.padres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terapeutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pictogramas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura para todos los autenticados" ON public.usuarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir modificación de propio perfil" ON public.usuarios FOR UPDATE TO authenticated USING (id_usuario = auth.uid());
CREATE POLICY "Lectura de padres autenticados" ON public.padres FOR SELECT TO authenticated USING (true);
CREATE POLICY "Modificación de propio perfil padre" ON public.padres FOR UPDATE TO authenticated USING (id_padre = auth.uid());
CREATE POLICY "Lectura de pacientes autenticados" ON public.pacientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Modificación de propio perfil paciente" ON public.pacientes FOR UPDATE TO authenticated USING (id_paciente = auth.uid());
CREATE POLICY "Lectura de terapeutas autenticados" ON public.terapeutas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Modificación de propio perfil terapeuta" ON public.terapeutas FOR UPDATE TO authenticated USING (id_terapeuta = auth.uid());
CREATE POLICY "Acceso a expedientes para terapeutas y padres" ON public.expedientes FOR ALL TO authenticated USING (true);
CREATE POLICY "Lectura e inserción de mensajes para emisor/receptor" ON public.mensajes FOR ALL TO authenticated USING (true);
CREATE POLICY "Lectura e inserción de alertas" ON public.alertas FOR ALL TO authenticated USING (true);
CREATE POLICY "Lectura y gestión de pictogramas" ON public.pictogramas FOR ALL TO authenticated USING (true);

-- ====================================================
-- 2. DATOS DE SEEDER (seeder.sql)
-- ====================================================

-- Padre / Tutor (contraseña: dino1234)
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated',
    'padre@dino.com',
    crypt('dino1234', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"rol": "padre", "telefono": "55-1234-5678", "direccion": "Calle de los Dinosaurios 123"}',
    NOW(), NOW(),
    '', '', '', ''
);

-- Paciente (TEA) (contraseña: dino1234)
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated',
    'paciente@dino.com',
    crypt('dino1234', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"rol": "paciente", "etapa_vida": "6-12", "nivel_comunicacion": "Básico"}',
    NOW(), NOW(),
    '', '', '', ''
);

-- Terapeuta (contraseña: dino1234)
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated',
    'terapeuta@dino.com',
    crypt('dino1234', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"rol": "terapeuta", "especialidad": "Psicóloga Infantil especialista en TEA", "cedula": "CED-123456"}',
    NOW(), NOW(),
    '', '', '', ''
);

-- Relación Padre - Paciente
INSERT INTO public.padres_pacientes (id_padre, id_paciente)
VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- Relación Terapeuta - Paciente
INSERT INTO public.terapeutas_pacientes (id_terapeuta, id_paciente)
VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222');

-- Sembrar Expediente Clínico Inicial
INSERT INTO public.expedientes (id_paciente, id_terapeuta, diagnostico, notas, avance)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    'TEA Grado 1 (Leve)',
    'El paciente muestra excelente respuesta visual a las secuencias de pictogramas. Se recomienda fomentar el uso de frases de 3 palabras en casa.',
    'Mejorando'
);

-- Mensajes de chat iniciales
INSERT INTO public.mensajes (emisor_id, receptor_id, mensaje, tipo)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'hola hijo como estas',
    'texto'
);

INSERT INTO public.mensajes (emisor_id, receptor_id, mensaje, tipo)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'yo querer jugar pelota',
    'pictograma'
);
