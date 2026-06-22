import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/utils/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    // Authenticate admin
    const passwordHeader = request.headers.get('x-admin-password');
    const correctPassword = process.env.ADMIN_PASSWORD || 'akbar123!';

    if (passwordHeader !== correctPassword) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { photoId, storagePath } = await request.json();
    if (!photoId || !storagePath) {
      return NextResponse.json({ error: 'Missing photoId or storagePath' }, { status: 400 });
    }

    const supabase = createServerSupabase();

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
    }

    // 1. Delete from Supabase Storage bucket
    const { error: storageError } = await supabase.storage
      .from('photos')
      .remove([storagePath]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // We continue to delete database record even if storage deletion fails,
      // in case the file doesn't exist anymore or path is invalid.
    }

    // 2. Delete from Database
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (dbError) {
      console.error('Database deletion error:', dbError);
      return NextResponse.json({ error: 'Failed to delete photo from database' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete photo action error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
