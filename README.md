# Aplikacja Inspekcji Budowy

Aplikacja PWA do zarządzania inspekcjami budów — usterki, zdjęcia, zadania, notatki i inwentaryzacja materiałów.

**Produkcyjny URL:** _(po deploy na Vercel — uzupełnij tutaj)_

---

## Funkcjonalności

- Hierarchia lokalizacji: piętra → Zmiany lokatorskie → mieszkania → pokoje
- Upload zdjęć z kamery telefonu i drag&drop plików
- Lista usterek (defect tracking) z wykonawcami i statusami
- Zadania globalne i per-piętro z optymistycznym przełączaniem
- Notatki globalne i per-piętro
- Inwentaryzacja materiałów (stan magazynowy per piętro, historia ruchów)
- PWA — instalowalna na telefon, odczyt offline

---

## Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | Next.js Server Actions |
| Baza danych | Supabase Postgres + RLS |
| Storage | Cloudflare R2 |
| Auth | Supabase Auth (magic link) |
| PWA | Service Worker (static, NetworkFirst/CacheFirst) |
| Walidacja | Zod |
| Hosting | Vercel |
| Monitoring | Sentry (opcjonalne) |

---

## Konfiguracja lokalna

### Wymagania

- Node.js 20+
- pnpm
- Konto Supabase

### 1. Klonowanie repozytorium

```bash
git clone <repo-url>
cd construction-app
pnpm install
```

### 2. Zmienne środowiskowe

Utwórz plik `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# Cloudflare R2 (Storage)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-xxx.r2.dev

# Opcjonalnie — Sentry
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
```

### 3. Migracje bazy danych

W Supabase SQL Editor wykonaj migracje w kolejności:

```
supabase/migrations/001_initial.sql
supabase/migrations/002_add_roof_floor.sql
supabase/migrations/003_add_task_fields.sql
supabase/migrations/004_simplify_hierarchy.sql
supabase/migrations/005_issues_contractor_photos.sql
supabase/migrations/006_drop_severity.sql
supabase/migrations/007_task_files.sql
```

### 4. Cloudflare R2

Utwórz bucket R2 w panelu Cloudflare i uzupełnij zmienne `R2_*` w `.env.local`. Supabase Storage nie jest już używany do przechowywania plików.

### 5. Supabase Auth

W panelu Supabase → **Authentication** → **URL Configuration**:
- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: dodaj `http://localhost:3000/auth/callback`

### 6. Uruchomienie

```bash
pnpm dev
```

Otwórz [http://localhost:3000](http://localhost:3000).

---

## Deploy na Vercel

1. Wypchnij kod na GitHub
2. Połącz repozytorium na [vercel.com](https://vercel.com)
3. Ustaw zmienne środowiskowe w ustawieniach projektu Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. W Supabase → Authentication → URL Configuration, ustaw:
   - **Site URL**: `https://twoja-domena.vercel.app`
   - **Redirect URLs**: `https://twoja-domena.vercel.app/auth/callback`
5. Deploy jest automatyczny po każdym pushu na `main`

---

## Screenshoty

| Ekran | Opis |
|---|---|
| Login | Ekran logowania (magic link) |
| Pulpit projektu | Lista 10 pięter z licznikami usterek i zadań |
| Drzewo lokalizacji | Mieszkania i podfoldery z menu kontekstowym |
| Galeria zdjęć | Upload i podgląd zdjęć z lokalizacji |

---

## Struktura projektu

```
app/
  (auth)/login/         # Logowanie magic link
  projects/             # Lista projektów
  projects/[id]/        # Pulpit projektu (10 pięter)
    floors/[level]/     # Widok piętra (drzewo + zadania + notatki)
    floors/[level]/[locationId]/  # Lokalizacja (pliki + usterki)
    inventory/          # Inwentaryzacja materiałów
    tasks/              # Zadania globalne
    notes/              # Notatki globalne
components/
  tree/                 # Drzewo lokalizacji
  upload/               # Upload plików i galeria
  issues/               # Usterki
  tasks/                # Zadania
  notes/                # Notatki
  inventory/            # Inwentaryzacja
lib/
  actions/              # Server Actions (mutacje)
  supabase/             # Klienci Supabase
supabase/migrations/    # Migracje SQL
public/
  sw.js                 # Service Worker (PWA, NetworkFirst/CacheFirst)
  manifest.json         # Web App Manifest
```

Szczegóły decyzji architektonicznych w `DECISIONS.md`.

---

## Licencja

Projekt prywatny — tylko do użytku wewnętrznego.
