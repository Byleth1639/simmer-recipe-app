# Simmer: Photo studio visibility and AI diagnostics update

Upload the extracted contents of this ZIP into the ROOT of your existing GitHub repository. Keep the mern/ and shared/ folder paths intact. Commit to the branch Render deploys, then wait for the deployment to finish and refresh the site.

Changes:
- Photo studio appears only when the backend reports imageGeneration=true. Your existing Colab generation/publishing workflow and saved Cloudinary images are unaffected.
- Rejected OpenAI requests now show specific, sanitized guidance for API authentication, billing/quota, model access, permissions, rate limits, or temporary provider failures. Raw provider messages and keys are never displayed.
- Root RecipeTools.tsx is kept identical to shared/RecipeTools.tsx.

This update does not supply API credits, replace API credentials, host an image-generation service, or prove a real OpenAI response works. It makes the next failed request actionable. After deployment, open a recipe, choose AI recipe ideas, and submit once. If it fails, use the specific message to correct the corresponding Render/OpenAI setting. Do not repeatedly retry billing or key errors.

Verification completed locally:
- TypeScript check and production build.
- Existing backend integration tests with a temporary MongoDB and mocked external providers.
- Additional tests for error classification, non-JSON responses, and credential redaction.
- No live OpenAI request was made with your credentials.

Run the new tests with: node --test tests/enhancement-errors.test.mjs
Official OpenAI error-code reference: https://developers.openai.com/api/docs/guides/error-codes
