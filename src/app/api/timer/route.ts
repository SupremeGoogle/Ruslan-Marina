import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/utils/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerSupabase();
    if (!supabase) {
      // Demo Mode fallback
      return NextResponse.json({
        status: 'reset',
        remainingSeconds: 10800,
        isDemo: true
      });
    }

    const { data: timerState, error } = await supabase
      .from('timer_state')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !timerState) {
      console.error('Error fetching timer state from DB:', error);
      return NextResponse.json({ error: 'Failed to fetch timer state' }, { status: 500 });
    }

    let remainingSeconds = timerState.remaining_seconds;
    const status = timerState.status;

    if (status === 'running') {
      const lastUpdated = new Date(timerState.updated_at).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastUpdated) / 1000);
      remainingSeconds = Math.max(0, timerState.remaining_seconds - elapsedSeconds);
    }

    return NextResponse.json({
      status,
      remainingSeconds,
      isDemo: false
    });
  } catch (error) {
    console.error('Timer API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
