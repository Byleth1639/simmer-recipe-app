# Simmer

A MERN recipe app with 105 recipes, search, saved recipes, a shopping list and an interactive ingredient explorer.

## Recipe photos

Opening a recipe without a photo automatically requests an AI image of that specific dish. For example, **Blueberry lemon pancakes** produces a request describing the pancakes, blueberries, lemon, other ingredients and the final preparation step. The image worker generates it, uploads it to Cloudinary and saves the URL on that recipe in MongoDB. The page checks progress and displays the completed photo. Later visits reuse it.

The source no longer ships the stock food-photo collection. The existing ingredient explorer is preserved. Generated photos and custom uploads already saved in your database are retained.

A cloud image-generation service must be running and connected for new photos to be created. The included `image-service/` is the Stable Diffusion/fastai service this app calls. The app does not connect to a visitor’s ChatGPT session. A neutral placeholder is shown before an image is ready, and an accurate offline message appears when generation is not connected. Saved photos continue to load while the generator is offline.

See **SIMMER-FIX-INSTRUCTIONS.md** for updating the existing site and **SETUP.md** for configuration.

## Commands

- `npm run setup`: install the client and server dependencies.
- `npm run dev`: start the client; start the API separately with its environment configured.
- `npm run build`: remove retired stock files that match their original checksums, then build the client.
- `npm start`: connect MongoDB, retire known stock-photo metadata, and run the API and image worker.
- `npm run typecheck`, `npm test`, `python tests/notebook-batch.test.py`: validation.

The cloud batch notebook remains an optional way to generate photos ahead of time. It is not required for the on-demand workflow when the image service is connected.
