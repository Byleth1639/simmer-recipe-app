# Simmer — automatic recipe photos

The approved ingredient explorer and its spotlight UI are preserved. This update changes the photo flow to generate one recipe’s image when that recipe is first opened.

## Update the existing site

1. Extract this ZIP and upload its contents to the **root of the existing GitHub repository**, keeping the folder structure.
2. Commit and let the existing Render service deploy. Keep its build command `npm run setup && npm run build` and start command `npm start`, or equivalent existing commands.
3. Connect a running cloud image service as described in **SETUP.md**. Existing MongoDB and Cloudinary settings are reused.
4. Open **Blueberry lemon pancakes**. A missing photo is queued automatically. When generation and upload finish, the recipe displays its new photo; subsequent visits use the saved image.

The new source contains no bundled stock food photos. Its build step also removes the known old copies from a deployment made by uploading over the existing repository. If you maintain a local Git checkout, `node scripts/remove-stock-photos.mjs` also removes those originals there so you can commit their deletion. Changed/custom files are protected by checksum matching.

## What happens for each recipe

- The server constructs a prompt and reproducible seed from the saved recipe. Visitors cannot provide arbitrary prompts or request overwriting an existing image.
- The worker generates the image, uploads it to Cloudinary, and stores its URL, AI provenance and recipe revision in MongoDB.
- The browser checks progress and refreshes the saved recipe when its image is ready.
- Concurrent visitors share the same job and one generation allowance. Cached photos load without a model call.
- Updating recipe ingredients or cooking steps makes a fresh image eligible. Old photo/recipe edits are protected from an outdated job.
- Usage limits, failures and disconnected services are reported accurately. Failed jobs have a retry cooldown. The app shows a neutral placeholder while a new image is unavailable.

The cloud generator must be running for this to work automatically. The optional Colab notebook can still pre-generate photos while you run it, but the notebook is not a hosted background service. Deploying this code alone does not create the images or connect a provider.

If all 105 recipes are eventually opened, each can end up with its own saved AI image. Those images are stored online, rather than being bundled stock photos in the source code.

## Validation

TypeScript and production build passed. The API tests cover the complete blueberry-lemon-pancake request, mocked generation/upload/persistence, reuse on subsequent visits, concurrent requests, source-photo retirement, origin restrictions, limits, failures and recipe edits. Cleanup tests verify that known stock files are removed and modified files are preserved. The existing cloud-notebook publishing tests still pass.

No live provider call, production deployment or cloud-image deletion was performed using your credentials. The included ingredient explorer files match the approved version.
