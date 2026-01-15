import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// Initialize database table if it doesn't exist
async function initDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS templates (
        id VARCHAR(255) PRIMARY KEY,
        storage_key VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_storage_key (storage_key)
      )
    `;
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// GET all templates for a storage key
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const storageKey = searchParams.get('storageKey');

    if (!storageKey) {
      return NextResponse.json({ error: 'storageKey is required' }, { status: 400 });
    }

    await initDatabase();

    const { rows } = await sql`
      SELECT id, name, content, created_at as "createdAt"
      FROM templates
      WHERE storage_key = ${storageKey}
      ORDER BY created_at DESC
    `;

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching templates:', error);
    // Fallback to empty array if database not available
    return NextResponse.json([]);
  }
}

// POST create new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, storageKey, name, content } = body;

    if (!id || !storageKey || !name || !content) {
      return NextResponse.json(
        { error: 'id, storageKey, name, and content are required' },
        { status: 400 }
      );
    }

    await initDatabase();

    const createdAt = new Date().toISOString();

    await sql`
      INSERT INTO templates (id, storage_key, name, content, created_at)
      VALUES (${id}, ${storageKey}, ${name}, ${content}, ${createdAt})
    `;

    return NextResponse.json({
      id,
      name,
      content,
      createdAt,
    });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}

// DELETE template
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await initDatabase();

    await sql`
      DELETE FROM templates
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
