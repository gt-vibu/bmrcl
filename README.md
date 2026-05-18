<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f192f2c2-ea33-4a02-8d5c-dee3115f4f9d

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local`
3. Paste your MongoDB Atlas connection string into `MONGODB_URI`
4. Optional: set `MONGODB_DB_NAME` to choose the database name. The default is `csi_main`
5. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
6. Run the app:
   `npm run dev`

On first startup, the server seeds MongoDB with the metro lines, interchanges, fare rules, and timings if the `appData` collection does not already contain the `metro-data` document.

## MongoDB Atlas

Your local `.env.local` should look like this:

```env
MONGODB_URI="mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB_NAME="csi_main"
```

For deployment, add the same `MONGODB_URI` and `MONGODB_DB_NAME` values in your hosting provider's environment variables. Do not commit the real Atlas URI.

After the app starts, open `/api/health/db`. A successful Atlas connection returns:

```json
{ "ok": true, "database": "csi_main" }
```
