# Enable all of Simmer's features

This upgrade adds OpenAI recipe variations, Cloudinary image storage, a Stable Diffusion Python service with a fastai inference adapter, Bootstrap UI components, and an interactive Three.js ingredient view. Your 105 recipes, favorites and shopping lists stay in place.

The Bootstrap interface and 3D view work after the Node/React upgrade is deployed. AI suggestions and image generation become available after you add your own service credentials. No API keys or model weights are included.

## 1. Upload the upgrade to your existing GitHub repository

Download and extract `simmer-all-features-upgrade.zip`. Open the extracted folder so you see `mern`, `shared`, `image-service`, and the other files. On the **main page of your existing repository**, choose **Add file → Upload files** and drag in those contents. The upgrade is below GitHub's 100-file upload limit; your existing photo files are not included or removed. Commit to the branch Render deploys.

If using the full-project ZIP instead, its existing photos need separate upload batches as before. Use the smaller upgrade ZIP when updating the already-working site.

In Render, confirm your service's root directory is the repository root and use:

Build command:

```sh
npm ci --omit=dev --prefix mern/server && npm ci --include=dev --prefix mern/client && npm run build --prefix mern/client
```

Start command:

```sh
node mern/server/server.mjs
```

Keep your working `MONGODB_URI`, `APP_ORIGIN`, `NODE_ENV` and compatible Node version. For the current address, `APP_ORIGIN` is `https://simmer-recipe-app.onrender.com` with no trailing slash. Let Render deploy the new commit.

Open a recipe and choose **Explore in 3D**. Drag the plate, zoom, select ingredient buttons and try the spacing slider. The scene is a stylized ingredient visualization made from Three.js geometry; it is not a photorealistic reconstruction of the finished dish.

## 2. Enable OpenAI recipe variations

1. Sign in at https://platform.openai.com/api-keys and create a project API key. Set up API billing or usable API credits for that project.
2. In **Render → your service → Environment**, add:

| Key | Value |
| --- | --- |
| `OPENAI_API_KEY` | Your project API key |
| `OPENAI_MODEL` | `gpt-4.1-mini` |
| `AI_DAILY_LIMIT` | `30`, or a lower daily cap you prefer |

3. Save and redeploy. Open a recipe → **AI recipe ideas**, choose a cooking goal and diet preference, then **Suggest variations**.

The server uses the Responses API with a strict JSON schema. It caches suggestions for seven days and shares matching requests so repeat views do not repeatedly call OpenAI. Daily limits count new provider attempts in UTC and are persisted in MongoDB. Failed provider attempts also count. Suggestions do not overwrite your original recipe.

## 3. Put the recipe images on Cloudinary

1. Create an account at https://cloudinary.com and find your product environment's **Cloud name**, **API key** and **API secret** in its dashboard.
2. Add these variables to Render, save and redeploy:

| Key | Value |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Cloud name |
| `CLOUDINARY_API_KEY` | API key |
| `CLOUDINARY_API_SECRET` | API secret |
| `CLOUDINARY_FOLDER` | `simmer` |

3. To migrate the existing photos, download your updated GitHub repository as a ZIP and extract it locally. This full repository must include the `public/food` images already uploaded earlier.
4. On your computer, open a terminal in its `mern/server` folder. With Node.js installed, run:

```sh
npm ci
```

5. Copy `.env.example` to `.env`, then privately fill in `MONGODB_URI` and the three Cloudinary credentials. Keep `.env` off GitHub; it is ignored by the supplied `.gitignore`.
6. Run:

```sh
npm run media:upload
```

The script uploads local recipe photos sequentially and updates their MongoDB image URLs. It preserves recipe text and attribution. Photos already using external/cloud URLs are skipped. The final line reports uploaded, skipped and failed counts. If Atlas rejects the local connection, add your computer's current IP in Atlas Network Access.

Refresh your site and inspect a recipe image: its URL should begin with `https://res.cloudinary.com/`. Cloudinary now stores/delivers the photos; MongoDB stores URLs and metadata, not image binaries. Bundled photos remain available as fallbacks.

## 4. Host the Stable Diffusion image service

The image model runs separately from the small Render Node web service. Use a GPU-capable host, or run the Python service locally on a sufficiently capable computer. CPU generation is supported but substantially slower.

A Docker deployment is included under `image-service/`. One hosted option is a Hugging Face Docker Space:

1. Create a **Docker Space** at https://huggingface.co/new-space. Use a public Space for this setup; the generation endpoint itself requires your secret service token. Compute Spaces and GPU hardware can require paid plans or usage charges, depending on your account and hardware selection. You can also run the service on your own machine instead.
2. Upload the **contents of `image-service`** into the Space repository's root: `Dockerfile`, `requirements.txt`, `app.py`, `engine.py`, and its own `README.md`. Keep the main website in your existing GitHub/Render repository.
3. Generate a random service token on your own computer with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

4. In the Space's **Settings → Variables and secrets**, add `SD_SERVICE_TOKEN` as a **secret** using that value. Set `DEVICE=auto`, `PRELOAD_MODEL=1`, and `MODEL_ID=stable-diffusion-v1-5/stable-diffusion-v1-5` as variables. If the model requires account access, accept its license on Hugging Face and add a read-only `HF_TOKEN` secret.
5. Select suitable hardware and let it build. The first weight download/warmup can take several minutes. Open the Space's direct app URL, such as `https://YOUR-SPACE.hf.space/health`. Wait for `modelLoaded` to become `true`. If warmup fails, check the host logs, model access and available memory.
6. Copy the direct app base URL, without `/health`, to Render's `SD_SERVICE_URL`. Copy the same service token to Render's `SD_SERVICE_TOKEN`.
7. Generate a **second, different** random token using the command above. Put it in Render's `ADMIN_TOKEN`. This is your private kitchen-owner token for the website's Photo studio.
8. Set `IMAGE_DAILY_LIMIT=5` and `SD_REQUEST_TIMEOUT_MS=600000` in Render. Save and redeploy.

Example Render variables for this step:

| Key | Value |
| --- | --- |
| `SD_SERVICE_URL` | The image service's direct HTTPS base URL |
| `SD_SERVICE_TOKEN` | The secret shared with the Python service |
| `ADMIN_TOKEN` | A different random token, at least 32 characters |
| `IMAGE_DAILY_LIMIT` | `5` |
| `SD_REQUEST_TIMEOUT_MS` | `600000` |

Cloudinary credentials from step 3 are also required because generated photos are uploaded there.

Open a recipe → **Photo studio**. Enter your `ADMIN_TOKEN`. A recipe with no photo can generate one directly. To test with an existing recipe, check **Replace the existing photo when the new one is ready**, then choose **Generate recipe photo**. Your old photo remains visible until the new image is successfully generated and uploaded. The job status updates while you wait.

This service loads pretrained Stable Diffusion weights using Diffusers. A real fastai `Learner.get_preds` adapter executes image inference and gathers output tensors. It does not train or fine-tune Stable Diffusion. The default model's safety checker remains enabled. Generated photos are labeled as AI illustrations.

## 5. Verify before describing it on your résumé

Check these behaviors on the live site:

- AI recipe ideas return actual variations for a selected goal/diet.
- A repeated identical request uses the cached result.
- The Three.js view rotates, zooms and highlights ingredients; changing servings changes the quantities.
- Cloudinary migration reports successful uploads, and the site's photo URLs use Cloudinary.
- Photo studio completes a real Stable Diffusion job and displays the generated image.
- Favorites and shopping lists still work after refreshing.

API usage, image hosting and GPU hosting are subject to your providers' plans. Your keys belong only in server environments or local ignored `.env` files, never in React code or `VITE_...` variables.

Validation included with this code: recipe/data tests, Express/Mongoose integration tests using a temporary local MongoDB and mock external providers, browser checks, and Python HTTP/fastai adapter tests with a tiny test pipeline. Live OpenAI/Cloudinary calls and full Stable Diffusion model generation require your accounts/hardware and were not performed with your credentials.

Useful official documentation:

- OpenAI structured outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Cloudinary Node uploads: https://cloudinary.com/documentation/node_image_and_video_upload
- Fastai inference: https://docs.fast.ai/learner.html
- Diffusers Stable Diffusion: https://huggingface.co/docs/diffusers/api/pipelines/stable_diffusion/text2img
- Hugging Face Docker Spaces: https://huggingface.co/docs/hub/spaces-sdks-docker
- Bootstrap/Vite: https://getbootstrap.com/docs/5.3/getting-started/vite/
- Three.js OrbitControls: https://threejs.org/docs/pages/OrbitControls.html
