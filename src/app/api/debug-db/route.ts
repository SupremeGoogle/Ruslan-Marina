import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/utils/supabaseClient';

export async function GET() {
  const supabase = createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client is null' });
  }

  const results: any = {};

  // Test 1: Query timer_state
  try {
    const { data, error } = await supabase.from('timer_state').select('*');
    results.timer_state = { data, error };
  } catch (err: any) {
    results.timer_state = { error: err.message };
  }

  // Test 2: Query photos
  try {
    const { data, error } = await supabase.from('photos').select('*');
    results.photos = { count: data?.length, error };
  } catch (err: any) {
    results.photos = { error: err.message };
  }

  // Test 3: List Storage buckets
  try {
    const { data, error } = await supabase.storage.listBuckets();
    results.storage = { buckets: data?.map((b: any) => b.name), error };
  } catch (err: any) {
    results.storage = { error: err.message };
  }

  return NextResponse.json(results);
}
