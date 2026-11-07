# Simmer — Full-stack Recipe Kitchen

A MERN recipe application with 105 recipes, search/filtering, pantry matching, serving adjustments, favorites, and shopping lists, plus optional AI and cloud-image features.

**Start with [SETUP.md](SETUP.md)** for GitHub/Render deployment, account setup, environment variables and verification.

| Feature | Implementation |
| --- | --- |
| Frontend | React, TypeScript and Vite |
| Backend / storage | Express, Node.js, MongoDB and Mongoose |
| Responsive tools | Bootstrap 5.3 with custom Simmer styles |
| Recipe variations | OpenAI Responses API, strict structured output, MongoDB cache and daily attempt limits |
| Cloud images | Signed server-side Cloudinary uploads and a one-time existing-photo migration script |
| Missing-photo generation | Separate Python/FastAPI Stable Diffusion service, Diffusers and a real fastai Learner inference adapter |
| Interactive 3D | On-demand Three.js ingredient scene with orbit/zoom controls, ingredient selection, spacing and serving quantities |

The 3D scene is a stylized ingredient visualization. The image model uses pretrained Stable Diffusion weights; this project does not train or fine-tune a model. AI suggestions and generated photos are not claims of kitchen testing or nutritional analysis.

## Layout

- `mern/client/`: deployed React/Vite entrypoint and dependencies.
- `shared/Kitchen.tsx`: recipe interface and existing kitchen features.
- `shared/RecipeTools.tsx`: Bootstrap AI, photo-studio and 3D controls.
- `shared/RecipeScene.tsx`: lazy-loaded Three.js scene and resource cleanup.
- `shared/recipes.mjs`, `shared/additional-recipes.mjs`: recipe catalog and utility functions.
- `mern/server/app.mjs`: Express routes, anonymous visitor cookies and request limits.
- `mern/server/models.mjs`: MongoDB schemas, cached enhancements, jobs and usage counters.
- `mern/server/services/`: OpenAI, Cloudinary and Stable Diffusion adapters and the photo worker.
- `mern/server/scripts/migrate-media.mjs`: upload local catalog images to Cloudinary and update their URLs.
- `image-service/`: separately deployed Python model service, Dockerfile and tests.
- `public/`: existing local photo assets and photo credits.
- `tests/`: recipe/data and Express/Mongoose integration tests.

## Run locally

Use Node.js compatible with the supplied Vite version (Node 22.13+ works), Python 3.12 for the image service, and MongoDB or Atlas. Keep the full folder structure.

From the repository root:

```sh
npm run setup
```

Copy `mern/server/.env.example` to `mern/server/.env` and configure MongoDB. From `mern/server`, run `npm run dev`. In a second terminal, from `mern/client`, run `npm run dev`. Open `http://localhost:5173`; the Vite proxy forwards `/api` to port 3001.

The basic application, Bootstrap UI and 3D visualization do not require third-party API keys. Optional features report that they are not enabled until their server credentials are configured. Keep real `.env` files, API keys and model weights out of GitHub.

## Deployment

The website stays on Render with the same Atlas database. The Python image model runs on a separate suitable machine/host. Full instructions are in `SETUP.md`.

Build from the repository root:

```sh
npm ci --omit=dev --prefix mern/server && npm ci --include=dev --prefix mern/client && npm run build --prefix mern/client
```

Start:

```sh
node mern/server/server.mjs
```

Starter data inserts by stable IDs without overwriting recipe text. Existing shared local photo paths are migrated as in the earlier photo fix; custom, Cloudinary and generated URLs are preserved. The cloud migration and generated-photo worker update only image fields. Existing favorites and shopping lists remain stored under the same anonymous cookie.

## Verification

```sh
npm test
npm run build
```

`npm test` runs catalog checks and integration tests against a temporary MongoDB instance with simulated OpenAI/Cloudinary/image-service results. The integration tests do not use your Atlas database or API credits. The first test run downloads a MongoDB test binary.

Python service tests:

```sh
cd image-service
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

The Python tests execute the real fastai inference adapter with a tiny deterministic pipeline, HTTP authentication and safety-check rejection. They do not download full Stable Diffusion weights. A real model generation and live OpenAI/Cloudinary calls must be verified after configuring your own accounts. The browser validation covers the existing kitchen flows, Bootstrap controls, WebGL ingredient rendering, AI result display and photo-job polling with simulated external results.

## Usage and limits

Favorites and shopping lists are scoped to an anonymous browser cookie; there is no member login or cross-device account sync. Daily provider-attempt counters are stored in MongoDB and reset by UTC day. Cached AI results do not consume another provider attempt. Photo generation is owner-only; the owner token is entered in Photo studio and is not written to browser storage.

The photo worker is intended for one Node web-service instance. It persists queued jobs in MongoDB and marks in-flight jobs failed after a restart so the owner can retry. Run a single Node instance for this version. Existing recipe text is not overwritten by AI suggestions.

See `CREDITS.md` and `/photo-credits.html` for the supplied illustrative photos. Source images retain their individual licenses.
