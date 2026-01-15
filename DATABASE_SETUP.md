# Database Setup for Template Persistence

This application uses Vercel Postgres to store saved templates permanently across deployments.

## Setup Instructions

### 1. Create Vercel Postgres Database (Free Tier)

1. Go to your Vercel project dashboard
2. Navigate to the **Storage** tab
3. Click **Create Database**
4. Select **Postgres**
5. Choose a name (e.g., `anthropic-v3-db`)
6. Select a region close to your deployment
7. Click **Create**

### 2. Environment Variables (Automatic)

Vercel automatically adds the following environment variables to your project:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

**No manual configuration needed!** These are automatically available to your app.

### 3. Database Table (Auto-Created)

The database table is automatically created on first use. The schema:

```sql
CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(255) PRIMARY KEY,
  storage_key VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_storage_key (storage_key)
);
```

## How It Works

### Hybrid Storage System

The app uses a **hybrid approach** for maximum reliability:

1. **Primary**: Vercel Postgres (persists across deployments)
2. **Fallback**: localStorage (browser-side backup)

### Behavior:

- **Database Available**: All templates are saved to Postgres AND localStorage (as backup)
- **Database Unavailable**: Falls back to localStorage automatically
- Templates are loaded from database on app start
- localStorage serves as cache and fallback

### Benefits:

✅ Templates survive deployments
✅ Templates accessible across devices
✅ Automatic fallback if database is unavailable
✅ No setup required for local development (uses localStorage)

## Verifying Setup

After creating the database, check the browser console:

```
✅ Loaded 5 templates from database for templates_reference_script
```

If database is not set up:
```
⚠️  Database unavailable, using localStorage fallback
```

## Cost

- **Vercel Postgres Free Tier**:
  - 256 MB storage
  - 60 hours of compute per month
  - More than enough for template storage

## Local Development

No database setup needed for local development! The app automatically falls back to localStorage when the database is unavailable.

To test with database locally:
1. Install Vercel CLI: `npm i -g vercel`
2. Pull environment variables: `vercel env pull .env.local`
3. Run: `npm run dev`

## Troubleshooting

### Templates not persisting after deployment

1. Verify Postgres is created in Vercel dashboard
2. Check environment variables are set (Storage → Postgres → .env.local tab)
3. Redeploy the app after creating the database

### Database connection errors

The app will automatically fall back to localStorage. Check:
- Vercel Postgres is active and not paused
- Environment variables are properly set
- You haven't exceeded free tier limits

## Migration from localStorage

When you first set up the database, existing localStorage templates won't be automatically migrated. You can:
1. Save new templates (they'll go to the database)
2. Re-save important existing templates
3. localStorage templates will still be available as fallback
