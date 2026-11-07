# Simmer configuration

Keep the existing MERN/Render deployment and MongoDB database.

## Web service

Install and build from the repository root:

```
npm run setup
npm run build
```

Start with `npm start`. Keep your existing `MONGODB_URI` and set `APP_ORIGIN` to the exact HTTPS origin of the website. Keep the existing Cloudinary credentials in the web service’s private environment:

```
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

## Automatic recipe photos

Run the included `image-service/` on a cloud host with enough resources for the model. It must expose its authenticated `/generate` endpoint at a URL reachable by the web service. Its Dockerfile and README describe that service. Then configure the web service:

```
SD_SERVICE_URL=https://your-running-image-service
SD_SERVICE_TOKEN=<a separate random secret of at least 32 characters>
AUTO_RECIPE_PHOTOS=1
IMAGE_DAILY_LIMIT=5
IMAGE_QUEUE_LIMIT=120
```

Use the same `SD_SERVICE_TOKEN` in the Python image service. Keep both Cloudinary and service credentials on the server. Visitors never enter or receive these secrets. Choose an intentional daily generation budget: the default is 5 newly generated photos per UTC day. Use a larger configured limit, such as 120, if you want up to the entire collection to be generated in a day. Cached images do not consume generation usage.

`ADMIN_TOKEN` enables the existing owner-only Photo studio controls. Automatic first-view generation does not require a visitor to enter an owner token. Set `AUTO_RECIPE_PHOTOS=0` to pause automatic generation while retaining saved images.

The cloud image service must actually be running. Uploading this source or having a ChatGPT account does not supply an image-generation backend. The Colab batch notebook runs only while its session is active and does not automatically become a hosted image service.

## Existing stock photos

The first server startup clears metadata that exactly matches the retired stock catalog. It preserves AI-generated images and unrelated custom uploads. The client build removes known old stock files only when their bytes still match their original checksums. Files changed by the user are kept. To remove the old files from your local Git checkout as well, run `node scripts/remove-stock-photos.mjs` and commit the removals.
