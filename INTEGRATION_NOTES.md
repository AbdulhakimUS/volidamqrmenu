# Integration notes — frontend adapted to the real backend

The frontend originally shipped with everything in `localStorage` and a
speculative API shape described in `BACKEND_HANDOFF.md`. The actual deployed
backend (`https://volidam-menu.onrender.com`, documented in `API_DOCS.md`)
turned out to have a different — and more capable — data model, so this pass
rewrites the integration points to match the real API instead.

## What changed in the data model

- Menu items no longer carry a free-text `tag`. They now belong to a
  `category_id`, and every category belongs to a `sectionId`. Categories and
  sections are their own resources (`/api/categories`, `/api/sections`), not
  auto-derived from item hashtags.
- Item `name` became a multilingual `title` (`{ uz, ru, en }`), and category /
  section names are multilingual too. A small `LocalizedInput` component
  (`src/components/LocalizedInput.tsx`) renders the 3-language fields
  wherever needed.
- Admins are keyed by numeric `id`, not `username`, and their role field is
  `admin_status` (a free-form string; `'super'` is the documented value that
  unlocks admin management).

## Where the integration lives

- **`src/api.ts`** — a single client covering every endpoint in
  `API_DOCS.md`: health, auth (login/logout), admins, categories, sections,
  and menu-items. It stores the JWT in `localStorage` and attaches
  `Authorization: Bearer <token>` to every request automatically.
- **`src/context/AuthContext.tsx`** — calls `/api/auth/login` and
  `/api/auth/logout`. Since the API has **no `GET /api/auth/me`**, the
  logged-in user (id / username / admin_status) is decoded straight out of
  the JWT payload (`decodeJwtPayload` in `src/utils.ts`) — this only reads
  the token, it doesn't verify the signature (the server does that on every
  protected call).
- **`src/context/MenuContext.tsx`** — fetches sections, categories, and menu
  items in parallel on load and exposes CRUD helpers for all three, each
  hitting the matching REST endpoint and then refetching to stay in sync.

## Behavioral notes / assumptions worth knowing about

- Reads (`GET`) are unauthenticated per the docs; writes attach the token.
- Photos are sent as either a plain URL or a `data:image/...;base64,...`
  string directly in the `photo` field of a menu item — per the docs the
  backend uploads it to Cloudinary itself, so there's no separate
  `/api/upload` call (unlike what `BACKEND_HANDOFF.md` proposed). The photo
  is still compressed client-side to a max 900px JPEG before being sent.
- `GET /api/admins` and the admin-management endpoints all require
  "main-admin" rights per the docs, so the Admins tab only fetches/shows
  anything when the logged-in user's `admin_status === 'super'`; everyone
  else sees a restricted-access message instead of a failed request.
- There's no documented endpoint to change an existing admin's
  `admin_status` after creation — only `username` (`PUT /admins/:id/username`)
  and `password` (`PUT /admins/:id/password`) can be edited afterward, so the
  UI only lets you set the status at creation time.
- The old hardcoded-username "protected owner account" business rule from
  `BACKEND_HANDOFF.md` isn't part of the real API contract, so it was dropped
  from the frontend; if that protection is still wanted, it needs to be
  enforced server-side, keyed off something other than a specific username
  (e.g. an `is_owner` flag, or simply the existing "can't remove the last
  super admin" rule).
- Error toasts show the backend's own Uzbek error messages (from the
  `{ success: false, error }` envelope) directly, since those are the ones
  listed in `API_DOCS.md`.
- `GET /api/health` is called once when the admin panel loads and shown as a
  small "API status" indicator in the header — this exercises the one
  endpoint that isn't otherwise used by the UI.

## Files removed

`src/data/categories.ts` and `src/data/seedItems.ts` are gone — categories
and seed data now live in the backend/database rather than the frontend
bundle.
