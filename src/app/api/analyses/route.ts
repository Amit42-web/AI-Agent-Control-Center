import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

// Initialize database connection
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error('No database URL found. Please set DATABASE_URL or POSTGRES_URL environment variable.');
}

const sql = databaseUrl ? postgres(databaseUrl, {
  ssl: 'require',
  max: 1,
}) : null;

// Initialize database table if it doesn't exist
async function initDatabase() {
  if (!sql) return;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS analyses (
        id VARCHAR(255) PRIMARY KEY,
        storage_key VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        state JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_analyses_storage_key ON analyses(storage_key)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_analyses_updated_at ON analyses(updated_at DESC)
    `;
  } catch (error) {
    console.error('Error initializing analyses table:', error);
    throw error;
  }
}

// GET all analyses for a storage key
export async function GET(request: NextRequest) {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const searchParams = request.nextUrl.searchParams;
    const storageKey = searchParams.get('storageKey');
    const id = searchParams.get('id');

    if (!storageKey) {
      return NextResponse.json({ error: 'storageKey is required' }, { status: 400 });
    }

    await initDatabase();

    // If ID is provided, fetch single analysis
    if (id) {
      const rows = await sql`
        SELECT id, name, state, created_at as "createdAt", updated_at as "updatedAt"
        FROM analyses
        WHERE id = ${id} AND storage_key = ${storageKey}
      `;

      if (rows.length === 0) {
        return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
      }

      return NextResponse.json(rows[0]);
    }

    // Otherwise, fetch all analyses (without full state for performance)
    const rows = await sql`
      SELECT id, name, created_at as "createdAt", updated_at as "updatedAt"
      FROM analyses
      WHERE storage_key = ${storageKey}
      ORDER BY updated_at DESC
    `;

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching analyses:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST create or update analysis
export async function POST(request: NextRequest) {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = await request.json();
    const { id, storageKey, name, state } = body;

    if (!id || !storageKey || !name || !state) {
      return NextResponse.json(
        { error: 'id, storageKey, name, and state are required' },
        { status: 400 }
      );
    }

    await initDatabase();

    const now = new Date().toISOString();

    // Upsert: insert or update if exists
    await sql`
      INSERT INTO analyses (id, storage_key, name, state, created_at, updated_at)
      VALUES (${id}, ${storageKey}, ${name}, ${state}, ${now}, ${now})
      ON CONFLICT (id)
      DO UPDATE SET
        name = ${name},
        state = ${state},
        updated_at = ${now}
    `;

    return NextResponse.json({
      id,
      name,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error('Error saving analysis:', error);
    return NextResponse.json(
      { error: 'Failed to save analysis' },
      { status: 500 }
    );
  }
}

// DELETE analysis
export async function DELETE(request: NextRequest) {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await initDatabase();

    await sql`
      DELETE FROM analyses
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting analysis:', error);
    return NextResponse.json(
      { error: 'Failed to delete analysis' },
      { status: 500 }
    );
  }
}
