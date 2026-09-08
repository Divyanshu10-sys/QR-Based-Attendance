# Final Deployment Checklist

## Vercel (frontend)

### Easiest method
Set **Root Directory** to `frontend`, then deploy with no build command and no output directory.

### If deploying the repository root
The root `vercel.json` already rewrites `/` and all frontend routes/assets into `frontend/`.

## Render (backend)

This repository includes `render.yaml`. You can also create a Render Web Service manually:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check: `/api/health`

Set these required environment variables in Render:

- `MONGO_URI`
- `JWT_SECRET`
- `FRONTEND_ORIGIN` = your exact Vercel URL
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

The remaining variables have safe defaults in `backend/.env.example` / `render.yaml`.

## Connect Vercel to Render

After Render gives you a URL such as `https://your-backend.onrender.com`, edit:

`frontend/js/config.js`

and set:

```js
window.PRODUCTION_API_BASE_URL = 'https://your-backend.onrender.com/api';
```

Do not commit MongoDB credentials, JWT secrets, or real admin passwords.
