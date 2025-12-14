# Canva Icon Library Extension

This repository contains a Canva Apps SDK project tailored for serving a catalog of 20,000 SVG icons directly inside the Canva editor. The application indexes icon metadata, exposes a searchable gallery, and inserts any selected asset into the user's design with a single click.

## Capabilities

- **Icon catalog:** All SVGs under `assets/` are automatically discovered, normalized, and surfaced with categories, tags, size, and style information.
- **Search and filters:** The in-app UI allows keyword search plus filtering by category and style, returning only the relevant subset of icons.
- **One-click insertion:** Selecting an icon uploads the SVG to Canva via the Asset API and immediately adds it to the current design using the Design API.
- **Optimized build artifacts:** Production builds bundle the React app (`dist/app.js`) and embed only the manifest, keeping the Canva upload under 5 MB while the SVG assets live in an external CDN (Cloudflare R2, Vercel storage, etc.).

## Repository Structure

```
.
├── assets/                  # SVG icons grouped by category (each with metadata.json)
├── assets_manifest.json     # Generated manifest with normalized metadata and paths
├── src/
│   ├── index.tsx            # Intent registration
│   └── intents/
│       └── design_editor/
│           ├── index.tsx    # Intent implementation shell
│           └── app.tsx      # Icon gallery UI + Canva integration
├── styles/components.css    # App-specific styling
├── scripts/
│   ├── copy_assets.ts       # Optional helper if you need to bundle local assets
│   ├── generate_icon_index.ts# Builds assets_manifest.json (with optional CDN URLs)
│   └── start/               # Dev server utilities
├── webpack.config.ts        # Bundler configuration
├── tsconfig.json            # TypeScript configuration (includes JSON imports)
└── package.json             # Commands and dependencies
```

## Requirements

- Node.js 18.x or 20.10.x (see `.nvmrc` for the recommended version)
- npm 9.x or 10.x
- Canva Developer account with an app configured for previewing

> **Note:** The current machine is running Node 24 / npm 11, which falls outside the supported range. Switch to the version defined in `.nvmrc` (`nvm use`) before installing dependencies or running builds to avoid engine errors.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure the CDN base URL (required for production)**
   - Upload all SVG folders in `assets/` to your CDN of choice, preserving the directory structure (`<Category>/SVG/<file>.svg`).
   - Export the base URL so the manifest can record the canonical location. When using Cloudflare R2, the public URL typically looks like `https://pub-<random>.r2.dev/<bucket>` or any custom domain you have assigned.
     ```bash
     export ICON_CDN_BASE_URL="https://cdn.example.com/icons"
     ```
     The generator encodes path segments automatically (spaces become `%20`, etc.). Omit this variable only when developing locally with the raw `assets/` directory still present.
3. **Generate the icon manifest**
   ```bash
   npm run generate:icons
   ```
   This command scans every `assets/<Category>/metadata.json`, derives CDN URLs when `ICON_CDN_BASE_URL` is provided, and writes a consolidated manifest to `assets_manifest.json`. Run it whenever SVGs or metadata change or when you change the CDN base path.
4. **Start the development server**
   ```bash
   npm start
   ```
   The server listens on `http://localhost:8080`. Preview the app inside Canva via the Developer Portal by setting the Development URL to this address.

## Development Workflow

| Task | Command | Notes |
| --- | --- | --- |
| Upload SVGs to Cloudflare R2 | `npm run upload:icons` | Requires R2 credentials in env vars (see below) |
| Refresh manifest after editing `assets/` | `npm run generate:icons` | Rebuilds `assets_manifest.json` |
| Run the local Canva app | `npm start` | Launches the webpack dev server |
| Production build | `npm run build` | Generates `dist/app.js`, bundles the manifest, and extracts i18n strings |
| Lint TypeScript types | `npm run lint:types` | Verifies TS configuration |
| ESLint | `npm run lint` | Uses Canva's app ESLint rules |
| Jest tests | `npm test` | Optional automated tests |

### Development server notes

- When using Safari or when testing Canva's HTTPS-only environments, start the dev server with the `--use-https` flag as described in `README.md` (Canva starter instructions) or configure ngrok/Cloudflare tunnels.
- Hot Module Replacement can be enabled by setting `CANVA_APP_ORIGIN` and `CANVA_HMR_ENABLED=true` in `.env`.

## Icon Manifest Details

`scripts/generate_icon_index.ts` produces a JSON file with the following structure:

```json
{
  "generatedAt": "2025-12-13T03:31:34.284Z",
  "count": 19774,
  "icons": [
    {
      "id": "access-time-access_time_20_filled",
      "category": "Access Time",
      "categorySlug": "access-time",
      "name": "Access Time",
      "description": "",
      "keyword": "fluent-icon",
      "tags": ["number", "24", "Circle"],
      "size": 20,
      "style": "filled",
      "file": "access_time_20_filled.svg",
      "relativePath": "assets/Access Time/SVG/access_time_20_filled.svg",
      "cdnUrl": "https://cdn.example.com/icons/Access%20Time/SVG/access_time_20_filled.svg"
    }
  ]
}
```

The React application imports this JSON directly (`resolveJsonModule` is enabled). At runtime it prefers the `cdnUrl` when available; otherwise it falls back to the relative path (useful only for local development with the raw `assets/` folder). When preparing a backend (Cloudflare Worker + R2/D1), this same manifest can seed the database and generate upload scripts (`scripts/deploy-icons.ts` placeholder).

## UI Overview

- **Search bar:** Filters icons by name, category, or tags in real time.
- **Category and style filters:** Built from the manifest, showing counts per category and list of styles (regular, filled, etc.).
- **Grid of icons:** Displays previews in a responsive grid. Each card shows the name, size, and style.
- **Insertion:** Clicking an icon uploads the SVG via `@canva/asset` and adds it to the design with `@canva/design`. If the design intent does not support insertion (e.g., in an unsupported preview), the UI disables the action and shows a warning.
- **Pagination:** A "Load more" button reveals additional icons in batches of 60 to keep the UI responsive even with tens of thousands of assets.

## Building for Canva

1. Ensure Node/npm match the required versions.
2. Run `npm install` (if not already done).
3. Regenerate the manifest: `npm run generate:icons`.
4. Build the app: `npm run build`.
5. Upload the contents of `dist/` (which now includes `app.js`, `assets_manifest.json`, and `messages_en.json`) to the Canva Developer Portal as the Production bundle. Because the SVG files live in your CDN, the zipped artifact stays well below the 5 MB limit.

## Hosting the frontend on Vercel

If you prefer serving the bundle from Vercel (either as a Development URL or even for production), the repository includes `vercel.json`, which instructs Vercel to:

- Install dependencies with `npm install`.
- Run `npm run build`.
- Serve the static output from `dist/`.

Deploy process:

1. Push your code to a Git repository connected to Vercel.
2. In the Vercel dashboard, set the project to use the root of this repo, leave the build command as “Use `vercel.json`”.
3. Add environment variables under *Project Settings → Environment Variables*:
   - `ICON_CDN_BASE_URL` (required so the manifest resolves to your R2 bucket).
   - Any Canva variables needed for your workflow (`CANVA_APP_ORIGIN`, etc.).
4. Trigger a deployment. Vercel will host the static bundle at a HTTPS URL such as `https://your-project.vercel.app`. Use that URL:
   - As the “Development URL” in the Canva Developer Portal when testing.
   - Or as a public endpoint serving `app.js` if you intend to keep it hosted there.

Remember that the SVG files still reside in Cloudflare R2; Vercel only serves the React bundle (`app.js`, manifest, localization files). This keeps the deployment lightweight while leveraging Vercel’s CDN for the UI.

## Uploading icons to Cloudflare R2

The repository ships with `npm run upload:icons`, a helper that pushes every SVG in `assets/` to an R2 bucket using Cloudflare's S3-compatible API. Before running it, set the following environment variables (you can store them in a `.env.local` and source it):

```bash
export R2_ACCOUNT_ID="xxxxxxxxxxxxxxxxxxxx"
export R2_ACCESS_KEY_ID="AKIAXXXXX"
export R2_SECRET_ACCESS_KEY="XXXXXXXXXXXXXXXX"
export R2_BUCKET_NAME="canva-icons"
# Optional: prefix inside the bucket, e.g., "icons"
export R2_PREFIX="icons"
```

The script keeps the directory structure intact (`<Category>/SVG/<file>.svg`). After uploading, set `ICON_CDN_BASE_URL` to the public URL that maps to the prefix you chose (for example, `https://pub-1234abcd.r2.dev/icons`). Regenerate the manifest so every entry contains the CDN path. You can then remove the local `assets/` folder before packaging if necessary; the app will fetch icons from R2 at runtime.

## Future Backend Integration (Optional)

Although icons are now delivered from an external CDN, the broader architecture still targets Cloudflare to centralize icon management and metadata:

```
Canva Frontend (React)
   ↓
Cloudflare Worker (Hono router)
├─ R2 bucket (SVG storage)
├─ D1 database (icon metadata, categories, tags)
└─ KV cache (search caching, optional)
```

- **R2:** Hosts the optimized SVG files (`icons/<category>/<file>.svg`) with public read access.
- **D1:** Stores metadata (ID, name, category, tags, R2 key, CDN URL) based on the schema in `schema.sql`.
- **KV:** Caches frequent search queries to minimize D1 reads.

When migrating, the existing manifest and scripts provide all the metadata needed to seed D1 and upload objects to R2.

## Troubleshooting

- **Engine mismatch:** If `npm install` fails with `EBADENGINE`, run `nvm use` to switch to the version defined in `.nvmrc`.
- **Missing manifest:** The app relies on `assets_manifest.json`. Run `npm run generate:icons` after adding/removing SVGs or metadata files.
- **Empty gallery in production:** Verify that `ICON_CDN_BASE_URL` was set before running `npm run generate:icons`, and confirm that the referenced URLs return the SVG files from your CDN.
- **Upload failures:** Ensure that the Canva preview is running over HTTPS and that the logged-in Canva user has access to the app ID configured in `.env`.
- **Performance:** If local development feels sluggish, reduce the initial `visibleCount` in `app.tsx` or generate a subset manifest for testing.

## Licensing

Refer to `LICENSE.md` for the terms provided by Canva. Icons sourced from third-party libraries should respect their respective licenses before being distributed through Canva.
