import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/utils/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ photos: [] });
    }
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Photo list error:', error);
      return NextResponse.json({ error: 'Failed to load photos' }, { status: 500 });
    }
    return NextResponse.json({ photos: data || [] });
  } catch (error) {
    console.error('Photo list error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
