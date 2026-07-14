# Online Scout

Vite React site for Online Scout, a Canadian property verification service for remote renters and newcomers.

The interface uses GSAP ScrollTrigger for the scroll narrative, image scale/fade motion, and word reveal section. Reduced-motion users receive a static experience.

## Run locally

```bash
npm install
npm run dev
```

The current local dev URL is:

```text
http://127.0.0.1:5177/
```

## Supabase setup

1. Create a Supabase project.
2. Run the SQL in `supabase/migrations/20260629140000_create_scout_requests.sql`.
3. Copy `.env.example` to `.env`.
4. Add your project values:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PROJECT_ID=your-project-ref
VITE_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
```

Older Supabase projects may call the public key `VITE_SUPABASE_ANON_KEY`; the app supports either name.

The public form inserts into `public.scout_requests`. If environment variables are missing, the form stays usable and shows a setup message instead of failing silently.

To test connectivity, probe the table endpoint. Supabase may return `401` for the REST root, while a configured table endpoint still works.

## Checks

```bash
npm run lint
npm run build
```
