# Vercel Deployment Setup Guide

## Setting Up OpenAI API Key in Vercel

Follow these steps to configure your OpenAI API key in Vercel:

### Step 1: Get Your OpenAI API Key
1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in to your OpenAI account
3. Click "Create new secret key"
4. Copy the key (it starts with `sk-proj-` or `sk-`)
5. **Save it securely** - you won't be able to see it again!

### Step 2: Add Environment Variable in Vercel

#### Option A: Using Vercel Dashboard (Recommended)
1. Go to your project on [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click on **"Settings"** tab
4. Navigate to **"Environment Variables"** in the left sidebar
5. Add a new environment variable:
   - **Key:** `NEXT_PUBLIC_OPENAI_API_KEY`
   - **Value:** Your OpenAI API key (e.g., `sk-proj-...`)
   - **Environment:** Select all environments (Production, Preview, Development)
6. Click **"Save"**

#### Option B: Using Vercel CLI
```bash
# Install Vercel CLI if you haven't already
npm i -g vercel

# Set the environment variable
vercel env add NEXT_PUBLIC_OPENAI_API_KEY

# When prompted:
# - Enter your OpenAI API key
# - Select all environments (Production, Preview, Development)
```

### Step 3: Redeploy Your Application
After adding the environment variable, you need to **redeploy** for changes to take effect:

#### Option A: Via Dashboard
1. Go to **"Deployments"** tab
2. Click the **three dots (...)** on the latest deployment
3. Select **"Redeploy"**

#### Option B: Via CLI
```bash
vercel --prod
```

#### Option C: Push to Git (Automatic)
If you have automatic deployments enabled, simply push a commit:
```bash
git commit --allow-empty -m "Trigger redeploy with env vars"
git push origin main
```

### Step 4: Verify Configuration
1. After deployment completes, open your application
2. Try running an analysis
3. If configured correctly, you should no longer see the API key error

---

## Important Notes

### Security Considerations
⚠️ **IMPORTANT:** This app currently uses the OpenAI API key **client-side** (in the browser), which means:
- The API key will be visible in the browser's JavaScript
- Anyone can extract and use your API key
- This could lead to unauthorized usage and unexpected charges

**For production apps, consider:**
- Moving OpenAI API calls to Next.js API routes (server-side)
- Using environment variables without the `NEXT_PUBLIC_` prefix on the server
- Implementing rate limiting and authentication

### Why NEXT_PUBLIC_ Prefix?
Next.js only exposes environment variables with the `NEXT_PUBLIC_` prefix to the browser. Variables without this prefix are only available on the server-side.

Since this app makes OpenAI API calls from the browser (client-side code in `useAppStore.ts`), the variable **must** start with `NEXT_PUBLIC_`.

### Multiple Environments
You can set different API keys for different environments:
- **Production:** Your main API key with rate limits
- **Preview:** A separate key for testing pull requests
- **Development:** A development key with lower limits

---

## Troubleshooting

### Still seeing "API key is not configured" error?
1. **Check variable name:** Must be exactly `NEXT_PUBLIC_OPENAI_API_KEY`
2. **Verify in Vercel:** Go to Settings > Environment Variables and confirm it's set
3. **Redeploy:** Environment variables require a rebuild to take effect
4. **Check browser console:** Open DevTools and look for any error messages

### Environment variable not working locally?
For local development, create a `.env.local` file:
```bash
NEXT_PUBLIC_OPENAI_API_KEY=sk-proj-your-key-here
```
Then restart your dev server: `npm run dev`

### Want to test without deploying?
Use Vercel's local environment:
```bash
vercel env pull .env.local
npm run dev
```

---

## Additional Configuration

### Changing the AI Model
By default, the app uses `gpt-4.1-mini`. To change this:

1. Add another environment variable in Vercel:
   - **Key:** `NEXT_PUBLIC_DEFAULT_MODEL`
   - **Value:** `gpt-4` or `gpt-3.5-turbo` or any OpenAI model name

2. Or update it in the UI's OpenAI Config section (temporary change)

---

## Need Help?
- [Vercel Environment Variables Docs](https://vercel.com/docs/projects/environment-variables)
- [Next.js Environment Variables Guide](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [OpenAI API Documentation](https://platform.openai.com/docs)
