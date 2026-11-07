> Current photo behavior is described in SIMMER-FIX-INSTRUCTIONS.md. The notes below describe earlier versions.

# Distinct-photo update

All 105 recipes now have different image files. The 100 added recipes use the new `public/food/recipes/` folder. Several of the previous shared stock images are retained once each; the other photos are new. Photos are illustrative, not photographs of the exact written recipes.

## Upload through GitHub in three batches

GitHub browser uploads have a file-count limit, so upload the new images separately from the code. Use the existing repository and branch connected to Render.

1. Extract this ZIP. In GitHub, open your existing `public/food` folder, then choose **Add file → Upload files**. Drag the extracted **`recipes` folder** from `public/food/recipes` into the upload area. Commit. The result must be `public/food/recipes/<recipe-id>.jpg` for each of the 100 images.
2. In GitHub, open `public`, choose **Add file → Upload files**, and upload the extracted **`public/photo-credits.html`** file. Commit.
3. Return to the repository's top level. Choose **Add file → Upload files** and drag in **all extracted project contents except the `public` folder**. This replaces the matching code paths. Commit. Keep the outer `simmer-recipe-app-main` folder out of the upload; drag its contents.

Upload images and credits before code so the image files exist when the new server starts. Render may auto-deploy after each commit. After the last commit, wait for its deployment to finish or select **Manual Deploy → Deploy latest commit**.

Keep your working Render environment variables unchanged. No Atlas reset or manual database editing is needed.

## Existing database photos update automatically

The server inserts missing recipes as before. It then updates only photo paths and attribution for the 100 added recipes whose stored images match the known earlier shared-photo paths. It also refreshes attribution for the new known paths on subsequent starts. Custom photo URLs are preserved, and recipe text, favorites and shopping lists are not reset.

After the final deployment, refresh the site. If your browser keeps an older page open, use Ctrl+Shift+R. Each recipe should have its own photo.

The update passed 16 automated checks, including different file paths and SHA-256 hashes for all 105 recipes. Image-only migration filters are unit-tested. Desktop/mobile browser checks use a simulated API; verify the live Render/Atlas deployment after uploading.
