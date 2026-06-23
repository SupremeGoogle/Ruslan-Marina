import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/utils/supabaseClient';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const photoId = String(body.photoId || '').trim();
    const guestId = String(body.guestId || '').trim();

    if (!photoId || !guestId) {
      return NextResponse.json({ error: 'Missing photoId or guestId' }, { status: 400 });
    }

    const supabase = createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
    }

    // Verify the photo belongs to the requesting guest before deleting.
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('id, guest_id, storage_path')
      .eq('id', photoId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }
    if (photo.guest_id !== guestId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await supabase.storage.from('photos').remove([photo.storage_path]).catch((err: unknown) => {
      console.warn('Storage remove warning:', err);
    });

    const { error: deleteError } = await supabase.from('photos').delete().eq('id', photoId);
    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Photo delete error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
