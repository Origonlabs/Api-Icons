# Canva Icon Library Extension

This repository contains a Canva Apps SDK project tailored for serving a catalog of 20,000 SVG icons directly inside the Canva editor. The application indexes icon metadata, exposes a searchable gallery, and inserts any selected asset into the user's design with a single click.

## Capabilities

- **Icon catalog:** All SVGs under `assets/` are automatically discovered, normalized, and surfaced with categories, tags, size, and style information.
- **Search and filters:** The in-app UI allows keyword search plus filtering by category and style, returning only the relevant subset of icons.
- **One-click insertion:** Selecting an icon uploads the SVG to Canva via the Asset API and immediately adds it to the current design using the Design API.
- **Optimized build artifacts:** Production builds bundle the React app (`dist/app.js`) and copy the icon library (`dist/assets/...`) so Canva can load both from a single upload.

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
│   ├── copy_assets.ts       # Copies assets into dist/ after a production build
│   ├── generate_icon_index.ts# Builds assets_manifest.json
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
2. **Generate the icon manifest**
   ```bash
   npm run generate:icons
   ```
   This command scans every `assets/<Category>/metadata.json` and writes a consolidated manifest to `assets_manifest.json`. Run it whenever SVGs or metadata change.
3. **Start the development server**
   ```bash
   npm start
   ```
   The server listens on `http://localhost:8080`. Preview the app inside Canva via the Developer Portal by setting the Development URL to this address.

## Development Workflow

| Task | Command | Notes |
| --- | --- | --- |
| Refresh manifest after editing `assets/` | `npm run generate:icons` | Rebuilds `assets_manifest.json` |
| Run the local Canva app | `npm start` | Launches the webpack dev server |
| Production build | `npm run build` | Generates `dist/app.js`, copies `assets/` into `dist/assets/`, and extracts i18n strings |
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
      "relativePath": "assets/Access Time/SVG/access_time_20_filled.svg"
    }
  ]
}
```

The React application imports this JSON directly (`resolveJsonModule` is enabled) and uses the `relativePath` field to render the SVG from `/assets/...`. When preparing a backend (Cloudflare Worker + R2/D1), this same manifest can seed the database and generate upload scripts (`scripts/deploy-icons.ts` placeholder).

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
5. Upload the contents of `dist/` (which now includes `app.js`, `assets/`, and `messages_en.json`) to the Canva Developer Portal as the Production bundle.

## Future Backend Integration (Optional)

Although the current implementation serves icons directly from the packaged `assets/` directory, the broader architecture targets Cloudflare:

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
- **Upload failures:** Ensure that the Canva preview is running over HTTPS and that the logged-in Canva user has access to the app ID configured in `.env`.
- **Performance:** If local development feels sluggish, reduce the initial `visibleCount` in `app.tsx` or generate a subset manifest for testing.

## Licensing

Refer to `LICENSE.md` for the terms provided by Canva. Icons sourced from third-party libraries should respect their respective licenses before being distributed through Canva.
