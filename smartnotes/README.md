# SmartNotes

> **Save anything. Remember everything.**

A production-grade, cross-platform (Android + iOS) notes app that automatically organises your saved content — links from YouTube, Instagram, Twitter/X, Google Maps, or anywhere else — into smart folders using AI/NLP.

---

## How it works

1. **Share a link** from any app on your phone to SmartNotes.
2. SmartNotes **extracts rich metadata** (title, thumbnail, description) from the link.
3. An NLP pipeline **extracts entities** — places, cuisines, activities, moods — as tags.
4. Tags are used to **auto-create and populate smart folders** (e.g. "Bangalore", "Food", "Cafes").
5. Notes appear in **every relevant folder** (a Bangalore food spot is in both "Bangalore" and "Food").

---

## Architecture

```
smartnotes/
├── backend/          FastAPI (Python) REST API
│   ├── app/
│   │   ├── api/      Route handlers (auth, notes, folders, tags, search)
│   │   ├── core/     Config + JWT security
│   │   ├── db/       SQLAlchemy async engine + session
│   │   ├── models/   ORM models (User, Note, Folder, Tag, NoteFolder)
│   │   ├── schemas/  Pydantic request/response schemas
│   │   └── services/ Metadata extractor · Tag extractor · Folder organizer
│   ├── alembic/      Database migrations
│   ├── requirements.txt
│   └── .env.example
│
└── mobile/           React Native + Expo (TypeScript)
    ├── App.tsx       Entry point
    └── src/
        ├── api/      Axios client + typed API modules
        ├── components/ NoteCard, FolderCard, TagChip, SearchBar, EmptyState …
        ├── navigation/ RootNavigator → Auth/App stack → Tab navigator
        ├── screens/  Home, Folders, FolderDetail, NoteDetail, AddNote, Search, Settings, Login, Register
        ├── store/    Zustand stores (auth, notes, folders)
        ├── theme/    Colors, typography, spacing design tokens
        └── utils/    Date formatting, URL helpers, share handler
```

---

## Backend Quick Start

```bash
cd smartnotes/backend

# 1. Create virtualenv
python -m venv .venv && source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env — at minimum set SECRET_KEY

# 4. Run (development)
uvicorn app.main:app --reload --port 8000

# 5. API docs
open http://localhost:8000/docs
```

### Environment variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy async URL | `sqlite+aiosqlite:///./smartnotes.db` |
| `SECRET_KEY` | JWT signing key | *(must change in prod)* |
| `OPENAI_API_KEY` | Optional — enables GPT tagging | empty |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | localhost |

### API endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Login → token pair |
| POST | `/api/v1/auth/refresh` | Refresh tokens |
| GET | `/api/v1/auth/me` | Current user |
| GET | `/api/v1/notes` | Paginated note list |
| POST | `/api/v1/notes` | Create note (triggers async enrichment) |
| PATCH | `/api/v1/notes/{id}` | Update note |
| DELETE | `/api/v1/notes/{id}` | Delete note |
| GET | `/api/v1/folders` | Folder tree |
| POST | `/api/v1/folders` | Create folder |
| GET | `/api/v1/folders/{id}/notes` | Notes in folder |
| POST | `/api/v1/folders/{id}/notes/{noteId}` | Add note to folder |
| DELETE | `/api/v1/folders/{id}/notes/{noteId}` | Remove note from folder |
| GET | `/api/v1/tags` | All tags |
| GET | `/api/v1/search?q=bangalore` | Full-text search |

---

## Mobile Quick Start

```bash
cd smartnotes/mobile

# 1. Install dependencies
npm install

# 2. Set API URL (edit or create .env)
echo "EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1" > .env

# 3. Start dev server
npx expo start

# 4. Scan QR with Expo Go app (iOS/Android) or press i/a for simulator
```

### Production build (EAS Build)

```bash
npm install -g eas-cli
eas login
eas build --platform all
```

---

## Smart Tagging

Tags are extracted using a two-tier pipeline:

1. **Rule-based** (offline, instant): Regex matches against curated dictionaries of Indian/world cities, cuisines, activities, and moods.
2. **GPT-powered** (optional): Set `OPENAI_API_KEY` in `.env` to enable richer, context-aware tagging via `gpt-4o-mini`.

---

## Production Deployment

| Component | Recommendation |
|---|---|
| Backend | **Railway** or **Render** (FastAPI with `gunicorn`) |
| Database | **PostgreSQL** (set `DATABASE_URL=postgresql+asyncpg://...`) |
| File storage | **Supabase Storage** or **AWS S3** for thumbnails |
| CI/CD | **GitHub Actions** → EAS Build → TestFlight + Play Store |
| Monitoring | **Sentry** (mobile + backend) |
| Analytics | **PostHog** |

---

## Extending the App

- **Semantic search**: Replace LIKE queries with `pgvector` embeddings.
- **Share extension**: Register the app as a share target in `app.json` / native config.
- **Push notifications**: Add Expo Notifications for proactive reminders ("You saved 5 Bangalore spots — going soon?").
- **Collaborative folders**: Add a `folder_members` table and real-time updates via Supabase Realtime.
- **Map view**: Integrate `react-native-maps` to plot geotagged notes on a map.
- **Offline mode**: Add WatermelonDB as a local cache layer.
