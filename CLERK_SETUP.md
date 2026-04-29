# Clerk Authentication Setup

This application uses [Clerk](https://clerk.com) for user authentication. Multiple users can sign in and manage their own analyses.

## Setup Instructions

### 1. Create a Clerk Account

1. Go to [https://dashboard.clerk.com/sign-up](https://dashboard.clerk.com/sign-up)
2. Create a free account
3. Create a new application

### 2. Get Your API Keys

1. In your Clerk dashboard, go to **API Keys**
2. Copy your **Publishable Key** (starts with `pk_test_` or `pk_live_`)
3. Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your Clerk keys to `.env.local`:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
   CLERK_SECRET_KEY=sk_test_your_secret_key_here
   
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
   ```

### 4. Deploy to Vercel

When deploying to Vercel:

1. Go to your project settings in Vercel
2. Navigate to **Environment Variables**
3. Add the same environment variables from your `.env.local`
4. Redeploy your application

## Features

- ✅ Email/Password authentication
- ✅ OAuth providers (Google, GitHub, etc.) - configure in Clerk dashboard
- ✅ User profiles with avatars
- ✅ Session management
- ✅ Protected routes (requires login)
- ✅ User-specific data storage (coming soon)

## Routes

- `/sign-in` - Sign in page
- `/sign-up` - Sign up page
- `/` - Protected main application (requires authentication)

## Customization

### Enable Social Login

1. Go to your Clerk dashboard
2. Navigate to **User & Authentication > Social Connections**
3. Enable providers like Google, GitHub, Microsoft, etc.
4. No code changes needed!

### Customize Appearance

Edit the `appearance` prop in:
- `src/app/sign-in/[[...sign-in]]/page.tsx`
- `src/app/sign-up/[[...sign-up]]/page.tsx`
- `src/components/auth/UserMenu.tsx`

See [Clerk's theming docs](https://clerk.com/docs/components/customization/overview) for more options.

## No Vercel Authentication Required

Clerk works independently of Vercel. You can:
- Deploy anywhere (Vercel, Netlify, AWS, etc.)
- Use any hosting provider
- Run locally for development
- No Vercel authentication needed

## Support

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Discord Community](https://clerk.com/discord)
- [GitHub Issues](https://github.com/Amit42-web/AI-Agent-Control-Center/issues)
