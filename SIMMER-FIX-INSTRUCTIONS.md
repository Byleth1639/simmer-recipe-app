# Simmer — recipe photos and ingredient explorer

## Install the site update

1. Extract this ZIP. Upload its contents to the **root of your existing GitHub repository**, preserving the `shared/`, `mern/`, `public/` and `tests/` folders.
2. Commit to the branch your existing Render service deploys. Wait for that deployment to finish, then refresh your site.
3. Open the avocado-toast recipe. Its explorer opens immediately. Choose **avocado**, **eggs**, or **radishes**: the chosen layer lifts forward, the other ingredients fade, and the selected amount and recipe step appear. The spotlight buttons in the prep list control the same explorer.

This is an update for your existing MERN/Render app. It does not create another website or change your hosting provider. Favorites, shopping data, and photos already stored in your database remain available.

## Create actual AI photos for the whole collection

**Deploying code does not generate the images. Run the included notebook once to replace the existing illustrative photos with generated ones.**

1. Open `public/Simmer_Cloud_Photos_Batch.ipynb` in Google Colab. You can also download it from any recipe’s **Photo studio** panel after deploying.
2. Select a GPU runtime. Run cells 1–4 to generate and inspect an avocado-toast preview.
3. Run cells 5–6. Use your existing MongoDB and Cloudinary credentials in Colab’s private prompts or Secrets, and allow the displayed Colab runtime address in Atlas Network Access as in your earlier notebook. Do not paste credentials into GitHub or this chat.
4. Leave `MAX_RECIPES` at `0` for the full collection, or choose `3` for a small batch. Each recipe gets its own prompt and seed based on its name, ingredients, description and cooking method. Images are generated with Stable Diffusion, uploaded to Cloudinary, and associated with the exact recipe ID.
5. Refresh your site. Successfully generated photos get an **AI illustration** badge on cards and an accurate photo label in the recipe. The featured hero uses the saved shakshuka photo too.

You can rerun the notebook after an interruption. Photos already generated are skipped, and failed images keep their current photo. Older AI photos created with your previous notebook are preserved. The notebook makes no OpenAI API calls and runs in Colab, so it does not require a model running on your computer. Colab must provide an available GPU; its runtime can stop before a long batch finishes. Review generated images: model output may differ from the cooked meal.

If you already run the hosted image service, the Photo studio can generate one recipe or queue the collection directly. `IMAGE_DAILY_LIMIT` still applies; its default is 5. To queue all 105 in one day, intentionally set `IMAGE_DAILY_LIMIT=120` and `IMAGE_QUEUE_LIMIT=120` in that existing service. Only the owner can submit jobs. The Colab workflow is independent of those server limits.

## What changed

- Recipe-specific assembled ingredient models replace the same little cubes and spheres for every dish. Avocado toast has bread, green avocado slices, egg whites and yolks, pink radish slices, lemon wedges and oil.
- A full ingredient index, persistent selected row, a lifted selected layer, faded surroundings, a focus ring, adjusted quantities and links to actual recipe steps make selection clear.
- The explorer retains selection when servings change and resets for a different recipe. Pointer selection and keyboard controls work with the same state.
- A vector-rendered fallback keeps the actual interactive model working when a browser cannot create WebGL.
- A resumable cloud notebook handles the complete recipe catalog instead of one manually chosen recipe at a time.
- The server exposes a recipe-only generation catalog with reproducible prompts, seeds and content keys. Queued jobs preserve newer photo/recipe edits, prevent duplicate active jobs, and report completed, failed and deferred work.
- The Photo studio remains visible when direct generation is offline, with the cloud notebook available there. Existing AI recipe error diagnostics are retained.

## Verification

- TypeScript check and production build passed.
- 46 Node checks passed, including authenticated batch generation, limits, duplicate requests, real database persistence with mocked image providers, and recipe-change protection.
- Five cloud-notebook publishing/resume tests passed with mocked image generation and storage.
- All 105 models were built and checked for selectable, finite geometry for every ingredient.
- The new UI was checked in a browser, including the vector fallback, ingredient spotlight, serving updates, recipe switching and cloud-notebook panel. That test browser has WebGL disabled; GPU rendering was not visually verified there.

No live image-generation request was made with your credentials. This ZIP does not deploy your Render service or contain 105 already-generated replacement images.

To rerun checks: `npm run setup`, `npm run typecheck`, `npm test`, `npm run build`, and `python tests/notebook-batch.test.py`.
