import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/utils/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const { guestId, firstName, lastName, ip } = await request.json();

    const cleanFirstName = typeof firstName === 'string' ? firstName.trim() : '';
    const cleanLastName = typeof lastName === 'string' ? lastName.trim() : '';

    if (!guestId || !cleanFirstName || !cleanLastName) {
      return NextResponse.json({ error: 'Missing guest id, first name, or last name' }, { status: 400 });
    }

    const supabase = createServerSupabase();

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
    }

    const { error: guestError } = await supabase
      .from('guests')
      .update({
        first_name: cleanFirstName,
        last_name: cleanLastName,
        ip_address: typeof ip === 'string' ? ip : null,
      })
      .eq('id', guestId);

    if (guestError) {
      console.error('Guest rename error:', guestError);
      return NextResponse.json({ error: 'Failed to rename guest' }, { status: 409 });
    }

    const { error: photosError } = await supabase
      .from('photos')
      .update({
        guest_name: `${cleanFirstName} ${cleanLastName}`,
      })
      .eq('guest_id', guestId);

    if (photosError) {
      console.error('Photo sender rename error:', photosError);
      return NextResponse.json({ error: 'Failed to update photo sender names' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Guest rename action error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
