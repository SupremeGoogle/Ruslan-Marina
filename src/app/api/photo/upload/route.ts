import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/utils/supabaseClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PER_GUEST = 5;

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const file = form.get('file');
    const guestId = String(form.get('guestId') || '').trim();
    const guestName = String(form.get('guestName') || '').trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if (!guestId || !guestName) {
      return NextResponse.json({ error: 'Missing guest info' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are accepted' }, { status: 415 });
    }

    const supabase = createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
    }

    // Enforce per-guest cap server-side too (client check can be bypassed).
    const { count, error: countError } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('guest_id', guestId);

    if (countError) {
      console.error('Count error:', countError);
      return NextResponse.json({ error: 'Failed to verify upload quota' }, { status: 500 });
    }
    if ((count ?? 0) >= MAX_PER_GUEST) {
      return NextResponse.json({ error: 'Upload limit reached' }, { status: 409 });
    }

    const extFromName = file.name.includes('.') ? file.name.split('.').pop() : null;
    const ext = (extFromName || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
    const uniqueName = `${guestId}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(uniqueName, Buffer.from(arrayBuffer), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload to storage' }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(uniqueName);

    const { data: inserted, error: insertError } = await supabase
      .from('photos')
      .insert({
        guest_id: guestId,
        guest_name: guestName,
        url: publicUrl,
        storage_path: uniqueName,
      })
      .select()
      .single();

    if (insertError || !inserted) {
      console.error('Photo insert error:', insertError);
      // Best-effort cleanup of orphaned object
      await supabase.storage.from('photos').remove([uniqueName]).catch(() => {});
      return NextResponse.json({ error: 'Failed to save photo record' }, { status: 500 });
    }

    return NextResponse.json({ success: true, photo: inserted });
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
