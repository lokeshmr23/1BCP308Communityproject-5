# GramSetu — Digital Complaint Portal for Gram Panchayat

A bilingual, mobile-first **academic engineering project** for rural citizens, Panchayat officials and system administrators. It demonstrates complaint intake, assignment and tracking, deadline escalation, notifications, feedback, CSV import and public transparency.

> **Academic prototype, not an official government service.** The sample Panchayat and 28 grievance records are synthetic. Replace demo accounts, sample records, deadlines and organization details before a field pilot. No paid API, SMS gateway, map provider or commercial UI service is required.

## Demo access

The login screen has one-click demo entry buttons. Seed credentials are also listed below (change/remove before deployment):

| Role | Email | Password |
|---|---|---|
| Citizen | `citizen@gpportal.demo` | `Citizen@123` |
| Panchayat official | `officer1@gpportal.demo` | `Officer@123` |
| Panchayat official | `officer2@gpportal.demo` | `Officer@123` |
| System admin | `admin@gpportal.demo` | `Panchayat@123` |

The demo citizen has six sample records, including resolved cases. The shared demonstration dataset is clearly marked as synthetic CPGRAMS-style records; it is **not** copied or represented as official CPGRAMS, data.gov.in or Panchayat data.

## What is implemented

- **Citizen:** create an account, register a complaint (category, ward, title, private description, public summary, landmark, optional coordinates and JPG/PNG/WebP image), receive a unique tracking ID, edit/withdraw an unassigned submission, view status history, and rate a resolved complaint.
- **Officials:** view the unassigned queue and their own assignments, assign/reassign an active request, add a remark, and move requests through the supported workflow.
- **Admin:** all complaint and analytics views; CRUD for categories, wards, officials and users; soft-archive complaints; deactivate users; import CSV records with row-level validation feedback.
- **Workflow:** `Submitted → Assigned → In Progress → Resolved` (or `Rejected`); terminal states cannot be silently reopened. Every material action adds an audit event.
- **Deadline escalation:** each category has an SLA in days. Active complaints past their deadline are marked high priority, receive an escalation event and in-app notification, and notify assigned officials and admins. The sweep runs on startup, every five minutes, and opportunistically on API traffic.
- **Notifications:** bilingual in-app notifications always work; email is optional and sent over SMTP when configured. No SMS is used.
- **Transparency:** public counts and redacted issue summaries for pending/resolved/rejected records. No citizen name, email, phone, exact GPS or private description is returned by public routes. Photos are not displayed on the public board.
- **Analytics:** category, ward and monthly trends; status breakdown; average resolution time; escalation count; and feedback average/count.
- **Languages:** English and Kannada interface toggle; seeded categories and wards contain English and Kannada names.
- **Responsive states:** sidebar navigation, search/filter, loading/error/empty states, upload validation, toast feedback and optimistic status/assignment updates.

## Tech stack

- Frontend: React 18, Vite, Tailwind CSS configuration, custom responsive design system, Recharts and Lucide icons.
- API: Node.js 20+, Express REST, Zod validation, JWT auth, `bcryptjs` password hashes, role checks, Multer upload limits and Helmet security headers.
- Storage: SQLite for local development; PostgreSQL via `pg` when `DATABASE_URL` is set. The same schema works with Supabase Postgres or Neon.
- Photo storage: local-only uploads for development; Supabase Storage in production. Production photo requests are rejected if persistent storage is not configured.
- Email: optional Nodemailer SMTP (Gmail App Password/Brevo/other SMTP). In-app notifications do not depend on email.

## Run locally

Requirements: Node.js 20+ and npm. A PostgreSQL server is **not** needed for local development.

```bash
npm install
cp .env.example .env       # optional for local use; set JWT_SECRET for non-demo work
npm run dev
```

Open the Vite address shown in the terminal (normally `http://localhost:5173`). The API is on `http://localhost:4000`. On first API start it creates `server/data/gramsetu.db`, creates tables and seeds demo accounts plus the synthetic CSV. `npm run dev` starts both processes. For production-like local serving:

```bash
npm run build
npm start                   # API serves client/dist when it exists
```

Use `npm run seed` to seed an empty database explicitly. It does not reset or overwrite a database that already contains users. To start fresh in local development, stop the API and remove `server/data/gramsetu.db` (and its `-wal` / `-shm` files).

### Environment variables

Copy `.env.example` to `.env`; never commit real secrets.

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | Hosting sets it | Express listen port; defaults to `4000` locally. |
| `NODE_ENV` | Recommended | Use `production` on Render; production requires remote photo storage for uploads. |
| `JWT_SECRET` | **Yes for deployment** | Long random signing secret; local fallback is only for development. |
| `DATABASE_URL` | No locally; yes for hosted DB | PostgreSQL connection string. If absent, SQLite is used. |
| `DB_PATH` | No | Optional SQLite file path; default `server/data/gramsetu.db`. |
| `SUPABASE_URL` | Optional | Supabase project URL for private photo storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional, server only | Storage upload and signed-URL key. **Never use a `VITE_` prefix or expose it in the browser.** |
| `SUPABASE_STORAGE_BUCKET` | Optional | Private bucket name; defaults to `complaint-photos`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Optional | Free-tier email over SMTP. Without these, in-app notifications still work. |
| `CLIENT_ORIGIN` | Recommended in production | Comma-separated exact frontend origin(s), e.g. `https://gramsetu.vercel.app`. |
| `VITE_API_URL` | Vercel/Netlify build | Frontend API base ending in `/api`, e.g. `https://gramsetu-api.onrender.com/api`. Local Vite uses its `/api` proxy. |

## Free-tier deployment (no paid services)

The included deployment path uses **Vercel Hobby** for the static frontend, a **Render Free web service** for Express, **Neon Free PostgreSQL** (its published free tier does not require a credit card), and **Supabase Storage Free** for optional private images. Supabase can instead provide both PostgreSQL and Storage. The app does not require a paid email or SMS API. Provider limits and signup/billing policies can change; select only free plans, keep all usage under their free quotas, and do not attach a payment method or enable paid add-ons. Render documents that a free web service sleeps after inactivity; Supabase Free projects may pause after inactivity. The free deployment is suitable for a class project/demo, not an uptime guarantee.

### 1) Create a PostgreSQL database

1. Create a Neon project on its Free plan (or a Supabase Free project) and save its database password. Neon documents a free tier with no credit card required.
2. Copy the pooled PostgreSQL connection string. If using Supabase, copy a connection string from **Project → Connect** and prefer the supported pooler/session connection for hosted IPv4 environments.
3. The API creates the schema and seeds it on first boot. Ensure the connection string includes SSL if the provider requires it, e.g. `?sslmode=require`.
4. Keep the database URL only in Render server environment variables.

### 2) Configure private photo storage (optional but recommended)

1. In Supabase Storage, create a **private** bucket named `complaint-photos` (or set `SUPABASE_STORAGE_BUCKET` to another name).
2. Set allowed MIME types to `image/jpeg`, `image/png`, `image/webp` and the maximum object size to 5 MB.
3. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_STORAGE_BUCKET` to the API environment only. The API signs photo URLs for one hour when an authorized complaint detail is viewed. The service-role key bypasses Storage RLS; protect it and rotate it if exposed.
4. If you do not want to configure Storage, the portal still works without photos. Local filesystem uploads are intentionally disabled in production because Render's free filesystem is ephemeral.

### 3) Deploy the API on Render Free

1. Push this repository to GitHub and create a Render **Web Service** from it. `render.yaml` is included; or enter the settings manually:
   - Build command: `npm ci --include=dev && npm run build`
   - Start command: `npm start`

   **Why `--include=dev`:** Vite/Tailwind/PostCSS are build-time dependencies. Because Render sets `NODE_ENV=production`, plain `npm ci` can omit devDependencies and fail with `Cannot find module 'tailwindcss'`. The flag is intentional; it installs build tools during the build.
   - Instance: **Free**
   - Root directory: repository root
2. Add environment variables in Render:
   - `NODE_ENV=production`
   - `JWT_SECRET` = a fresh random 32+ character value
   - `DATABASE_URL` = hosted PostgreSQL URL
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=complaint-photos` (for photos)
   - `SMTP_*` only if email is wanted
   - `CLIENT_ORIGIN` = exact Vercel/Netlify origin after step 4
3. Deploy. Check `https://YOUR-API.onrender.com/api/health` for `{ "status": "ok" }`.
4. First boot initializes tables and seeds the synthetic dataset. **Do not use this demo seed in a real Panchayat database.** Create/change admin credentials before inviting users.

### 4) Deploy the frontend on Vercel Hobby

1. Import the same Git repository into Vercel. Keep the project root at the repository root.
2. Build command: `npm run build`; output directory: `client/dist`; install command: `npm ci --include=dev`. `vercel.json` supplies these defaults.
3. Add `VITE_API_URL=https://YOUR-API.onrender.com/api` as a Vercel environment variable and redeploy.
4. Copy the final Vercel production origin into Render's `CLIENT_ORIGIN` (no trailing slash), then redeploy the API. For previews, add the exact preview origin if you want preview deployments to call the API.
5. Try a demo sign-in, a citizen submission, official assignment/status update, public tracking and a CSV import.

### 5) Optional free email

Email is optional. A Gmail SMTP account with 2-Step Verification and an **App Password** can be used for a small academic demonstration; use the generated App Password, not the regular Gmail password. Configure the `SMTP_*` variables only on Render. Providers apply sending limits and may require verification; failures are logged and do not block in-app notifications. Do not use paid SMS.

### Cold starts and free-tier caveats

- Render Free web services spin down after inactivity (currently documented as about 15 minutes) and can take roughly a minute to wake. The first page action may feel slow; show/retry after the API wakes. The UI displays a network hint for this case.
- Supabase Free projects may pause after a period of inactivity; Neon Free compute can scale to zero. The first database-backed request can also take longer after idle.
- The escalation sweep runs when the API process is alive and is checked on startup/API traffic. A sleeping service cannot run a timer. On wake, overdue records are swept; a hard-real-time SLA needs an always-on worker or external scheduler, which is outside this free demo.
- Free quotas, inactivity policies, terms and card requirements are provider-controlled and can change. Verify the current plan before deployment; the code itself calls no paid service. Official plan references: [Render free deployment guide](https://render.com/docs/your-first-deploy), [Render FAQ / idle sleep](https://render.com/docs/faq), [Vercel Hobby plan](https://vercel.com/docs/plans/hobby), [Supabase pricing](https://supabase.com/pricing), and [Neon Free plan FAQ (no card)](https://neon.com/faqs/managed-postgres-databases-free-tier). Vercel Hobby is aimed at personal projects; use it for a non-commercial academic demo, not a production government service.

## CSV import format and seed data

The admin Complaint Queue includes a CSV importer (1 MB; up to 1,000 records per request) with row-level skip reasons. Category and ward values must match an existing name or ID. Suggested headers:

```csv
reference_id,category,ward,title,description,public_summary,status,location_text,created_at,resolved_at,resolution_deadline,officer_email
```

See [`server/data/secondary-grievance-sample.csv`](server/data/secondary-grievance-sample.csv). It contains 28 **synthetic** CPGRAMS-style examples adapted to rural water, road, light, sanitation, drainage and welfare issues. The public summary is separate from the private description; never put a citizen's name, phone, email or precise address in it. The app redacts common phone/email patterns as a safety measure, but users must still review their public summary.

## API, architecture and methodology

- API routes, role model, ER diagram, use-case diagram and deployment boundaries: [`docs/architecture.md`](docs/architecture.md)
- Agile plan, related-system comparison and research links: [`docs/methodology-and-comparison.md`](docs/methodology-and-comparison.md)
- Survey / Google Forms field template (English + Kannada): [`docs/primary-data-survey.md`](docs/primary-data-survey.md)
- Manual test cases and evaluation plan: [`docs/testing-and-evaluation.md`](docs/testing-and-evaluation.md)

## Tests and build

```bash
npm test       # API workflow, role checks, public data privacy and utility tests
npm run build  # production Vite build
```

The API tests use an in-memory SQLite database. Browser/manual deployment testing is documented in `docs/testing-and-evaluation.md`.

## Security and academic-use checklist

- Replace demo passwords, `JWT_SECRET`, sample Panchayat identity and seeded synthetic records before any pilot.
- Use HTTPS; keep JWT tokens out of URLs; do not put database, SMTP or Supabase service keys in frontend environment variables.
- Public routes intentionally return summary-only data. Confirm consent, legal basis, retention policy, accessibility and public-record rules with the actual Panchayat before enabling public display.
- Photos and issue descriptions can contain sensitive data; minimize collection, obtain consent, set deletion/retention rules and keep the Storage bucket private.
- This project does not integrate with CPGRAMS, eGramSwaraj, Karnataka Janaspandana or any government identity system.
