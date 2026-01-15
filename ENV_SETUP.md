# Environment Variable Setup

## OpenAI API Key Configuration

⚠️ **IMPORTANT**: Due to Next.js client-side limitations, you need to use the correct environment variable name.

### For Vercel/Production Deployment:

In your Vercel dashboard or `.env.local` file, set **ONE** of these:

```bash
# Option 1: Use NEXT_PUBLIC_ prefix (Required for client-side code)
NEXT_PUBLIC_OPENAI_API_KEY=sk-your-api-key-here

# Option 2: Use standard name (Will be checked as fallback)
OPENAI_API_KEY=sk-your-api-key-here
```

### Why NEXT_PUBLIC_?

Next.js **only exposes environment variables with the `NEXT_PUBLIC_` prefix** to the browser (client-side code). Since this app makes OpenAI API calls from the browser, the variable MUST start with `NEXT_PUBLIC_`.

### Current Configuration:

The app checks **both** variable names:
1. First checks: `NEXT_PUBLIC_OPENAI_API_KEY`
2. Falls back to: `OPENAI_API_KEY`

### Recommended Solution:

If you currently have `OPENAI_API_KEY` set, **rename it** to:
```bash
NEXT_PUBLIC_OPENAI_API_KEY
```

### Alternative (More Secure):

For production apps, consider moving OpenAI API calls to server-side API routes to avoid exposing API keys in the browser. This would allow using `OPENAI_API_KEY` (without NEXT_PUBLIC_) securely on the server.

## Default Model

The default AI model is set to `gpt-4.1-mini`. Update `.env.local` to change:

```bash
NEXT_PUBLIC_DEFAULT_MODEL=gpt-4.1-mini
```
