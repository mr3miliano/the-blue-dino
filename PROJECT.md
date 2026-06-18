# Project: The Blue Dino

## Architecture
- **Frontend**: React (Vite) + Tailwind CSS (via components and styles).
- **Backend/DB**: Supabase (PostgreSQL + Auth + Realtime + Storage).
- **Mobile Packaging**: Tauri (prepared structure `src-tauri` / React build artifacts).
- **Services**:
  - `arasaac.js` — ARASAAC public API integration with offline cache via `localforage`.
  - `googleVoice.js` — Speech Synthesis & Recognition with Web Speech fallback.
  - `firebase.js` — Firebase Cloud Messaging mock/wrapper for push notifications.
  - `offlineSync.js` — Offline message & alert queuing and synchronization.
  - `supabase.js` — Supabase SDK client.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | DB Schema Validation | Validate schema.sql against gemini.md rules. Run PostgreSQL sanity checks on schema. | None | DONE (f84591fb-56de-4512-ae55-2c2b8f0243b9) |
| 2 | Auth Integration Review | Audit Splash Screen, Login, Register views and Supabase Auth integration. | M1 | DONE (aa44b7c5-d18a-40b4-ad06-ed451b4a377c) |
| 3 | Parent Dashboard Audit | Audit linking patient/therapist, Text-to-Pictogram translator, Realtime chat, and dossier view. | M2 | DONE (314ef7a1-5368-4a30-8362-8f965b310de5) |
| 4 | Patient Dashboard Audit | Audit visual communicator, lifetime-stage adapter, Realtime chat, and panic button functionality. | M3 | DONE (b41a3349-115d-444e-8549-d0a4845cfd69) |
| 5 | Therapist Dashboard Audit | Audit therapist patient views, patient CRUD/assignment, and dossier update logic. | M3 | DONE (1dd42994-e13a-4648-8f94-2ca2cb939a4a) |
| 6 | Offline & Push Validation | Audit offline synchronization tests (alerts, messages) and Firebase FCM notification triggers. | M4, M5 | DONE (20e2ef12-4549-4cbe-a60a-d9cfdbaf9b60) |
| 7 | End-to-End Test Suite | Verify all modules with comprehensive opaque-box test scenarios (Tiers 1-4). | M6 | DONE (8e0336c5-d4dd-4a23-ad04-4ae8f057cbec) |


## Interface Contracts
### Supabase Auth User Metadata ↔ Database Profiles
- User signs up via Supabase Auth and registers with custom metadata `rol` ('padre', 'paciente', 'terapeuta').
- Triggers inside `schema.sql` automatically populate target tables `usuarios`, and then role-specific tables `padres`, `pacientes`, or `terapeutas` respectively.

### Communication Engines
- **Speech Engine API**: `speak(text: string): Promise<void>` and `listen(): Promise<string>`
- **ARASAAC Translator API**: `getImagesForText(text: string): Promise<{word: string, image: string}[]>`

## Code Layout
- `src/`
  - `assets/` - Image and style assets
  - `components/` - Common UI elements
  - `store/` - Global context (`AppContext.jsx`)
  - `services/` - `supabase.js`, `arasaac.js`, `googleVoice.js`, `firebase.js`, `offlineSync.js`
  - `pages/` - `auth/`, `padre/`, `paciente/`, `terapeuta/`
