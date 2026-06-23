import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/utils/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    // Authenticate admin
    const passwordHeader = request.headers.get('x-admin-password');
    const correctPassword = process.env.ADMIN_PASSWORD;

    if (!correctPassword) {
      return NextResponse.json({ error: 'Admin auth is not configured' }, { status: 503 });
    }
    if (passwordHeader !== correctPassword) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guestId } = await request.json();
    if (!guestId) {
      return NextResponse.json({ error: 'Guest ID is required' }, { status: 400 });
    }

    const supabase = createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
    }

    // 1. Fetch guest's photos from DB to find their storage paths
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('storage_path')
      .eq('guest_id', guestId);

    if (fetchError) {
      console.error('Error fetching guest photos for deletion:', fetchError);
    }

    // 2. Delete photos from Supabase Storage bucket
    if (photos && photos.length > 0) {
      const storagePaths = photos.map((p: any) => p.storage_path);
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove(storagePaths);

      if (storageError) {
        console.error('Error deleting files from storage bucket:', storageError);
      }
    }

    // 3. Delete guest from DB (cascade delete will automatically delete from photos table)
    const { error: dbError } = await supabase
      .from('guests')
      .delete()
      .eq('id', guestId);

    if (dbError) {
      console.error('Error deleting guest from DB:', dbError);
      return NextResponse.json({ error: 'Failed to delete guest' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete guest error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
