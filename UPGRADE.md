# Upload this upgrade

This package contains only changed/new code and setup instructions. Your existing `public/food` images are not included or removed. The upload is below GitHub's 100-file browser limit.

1. Extract `simmer-all-features-upgrade.zip`.
2. Open the extracted folder so you see `mern`, `shared`, `image-service` and the other files.
3. On GitHub, open your existing repository's main page → **Add file → Upload files**.
4. Drag the extracted **contents** into the upload area, keep matching repository paths, and commit.
5. Let Render deploy the latest commit. Check the build/start commands in `SETUP.md`.
6. Open a recipe and test **Explore in 3D**. Then follow `SETUP.md` to configure OpenAI, Cloudinary and the separate image service.

The image-service folder is a separate Python service, not part of the Node process on Render. Read its own README when deploying it.
