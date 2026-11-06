# Simmer — Recipe Kitchen

A recipe discovery app with ingredient search, meal and diet filters, pantry matching, serving adjustments, step-by-step cooking mode, favorites and a persistent shopping list.

## Two ways to run

The same React UI and recipe utilities power both implementations:

| Version | Frontend | Backend | Database |
|---|---|---|---|
| Hosted preview | React / Vinext | TypeScript Cloudflare Worker API | D1 / SQLite |
| Standalone MERN | React / Vite | Node.js / Express | MongoDB / Mongoose |

The hosted preview is not a MERN deployment. The standalone version under `mern/` is the MERN implementation. It has no ChatGPT dependency. Favorites and lists use an anonymous HttpOnly browser cookie rather than user accounts; clearing cookies starts a new collection. The standalone version does not provide cross-device sync or member login.

## Run the MERN version on your computer

Prerequisites: Node.js 22.13+ and a local MongoDB server, or your own MongoDB Atlas connection string. Keep all the folders in this download together; the client and server import files from `shared/`.

1. Start MongoDB locally. A typical local connection is `mongodb://127.0.0.1:27017/simmer`.
2. In `mern/server`, copy `.env.example` to `.env`, set `MONGODB_URI` and run:

```sh
npm install
npm run dev
```

3. In a second terminal, open `mern/client` and run:

```sh
npm install
npm run dev
```

4. Open `http://localhost:5173`. Vite forwards `/api` requests to Express on port 3001.

The backend creates MongoDB collections and adds the five starter recipes without overwriting existing recipes with the same IDs. Use MongoDB Compass to inspect the `recipes`, `favorites` and `shoppings` collections.

### Deploy the MERN app independently

Run `npm run build` inside `mern/client`. Express serves this generated `dist` folder and the API together. Deploy the whole repository with Node.js hosting and a MongoDB connection. Set these environment variables:

- `MONGODB_URI`: your database connection string (server only)
- `APP_ORIGIN`: your exact public HTTPS origin, e.g. `https://your-domain.example` (no trailing slash)
- `NODE_ENV=production`: enables Secure cookies
- `PORT`: your host normally supplies this

Use a build command that installs the server and client dependencies and builds the client. Start with `node mern/server/server.mjs`. Keep the full folder structure so shared imports resolve. Test saved recipes and shopping items after deployment. Hosting/database services may have costs; no paid services are configured by this project.

## Hosted preview local development

From the project root, use the supplied pnpm lockfile:

```sh
pnpm install --frozen-lockfile
pnpm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_daily_lockheed.sql
pnpm run dev
```

Initialize the local database once. Hosted and local data are separate. Publishing helpers and `.openai/hosting.json` belong to the existing hosted preview; use your own hosting configuration when deploying elsewhere.

## What works

- Five original starter recipes with illustrative food photography.
- Search by words in the title, description or ingredients.
- Meal, diet and cooking-time filters.
- Pantry matching: enter comma-separated ingredient fragments. Recipes with any matching ingredient are ranked by number of matching ingredients. This is deterministic matching, not AI.
- Saved favorites and a server-persisted shopping list, isolated by anonymous browser cookie.
- Serving counts from 1 to 12, scaled ingredient quantities, prep checkboxes and cooking steps.
- Combining matching shopping ingredients with the same unit, checking items off and clearing checked items.
- Responsive styles, keyboard-accessible native dialogs, loading states and error messages.

Adding a recipe to the shopping list again adds its quantities again. Servings can produce fractional ingredient quantities; adjust practically when cooking. Times are recipe estimates. Photos are illustrative, not photos of these exact instructions. See `CREDITS.md`.

## Not implemented

- OpenAI recipe suggestions or recipe enhancement.
- Stable Diffusion / fastAI image generation.
- Three.js 3D recipe views.
- Recipe editing, personal accounts or cross-device identity.

No API keys are needed for the current feature set. Do not claim those AI/3D features on a résumé unless you implement and verify them.

## Verification

```sh
node --test tests/recipes.test.mjs
pnpm exec tsc --noEmit
pnpm run build
```

Seven tests cover ingredient search, combined filters, pantry ranking, serving scaling, shopping conversion and starter-data integrity. The standalone Vite frontend is separately built, and the Express entrypoint is syntax checked. A live MongoDB-backed end-to-end test still requires a MongoDB instance; the hosted adapter is browser tested separately.

## Learn the code

1. `shared/Kitchen.tsx`: React state, search controls, recipe dialog and API requests.
2. `shared/recipes.mjs`: starter data, search, pantry matching and serving calculations.
3. `mern/server/server.mjs`: MongoDB schemas and Express API.
4. `app/api/kitchen/route.ts`: equivalent hosted Worker/D1 API.
5. `db/schema.ts` and `drizzle/`: hosted database schema and migrations.
6. `app/globals.css`: responsive visual design.
7. `tests/recipes.test.mjs`: examples of edge cases to understand and extend.

A good first contribution is adding your own recipe, then explaining how its ingredients travel from the recipe dialog to the shopping-list database. Next add recipe creation/editing or authenticated accounts. Measure actual use before writing résumé metrics.
