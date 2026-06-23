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

    const { action } = await request.json();
    const supabase = createServerSupabase();

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
    }

    // Fetch current state
    const { data: currentState, error: fetchError } = await supabase
      .from('timer_state')
      .select('*')
      .eq('id', 1)
      .single();

    if (fetchError || !currentState) {
      return NextResponse.json({ error: 'Failed to fetch timer state' }, { status: 500 });
    }

    let nextStatus = currentState.status;
    let nextRemaining = currentState.remaining_seconds;
    const now = new Date().toISOString();

    if (action === 'start') {
      if (currentState.status !== 'running') {
        nextStatus = 'running';
        // remaining seconds stays the same, we just start counting down from now
      }
    } else if (action === 'stop') {
      if (currentState.status === 'running') {
        nextStatus = 'paused';
        // Calculate how much time elapsed since last updated_at and subtract it
        const lastUpdated = new Date(currentState.updated_at).getTime();
        const currentTime = new Date().getTime();
        const elapsedSeconds = Math.floor((currentTime - lastUpdated) / 1000);
        
        nextRemaining = Math.max(0, currentState.remaining_seconds - elapsedSeconds);
      }
    } else if (action === 'reset') {
      nextStatus = 'reset';
      nextRemaining = 10800; // 3 hours in seconds
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Update in Supabase
    const { data: updatedState, error: updateError } = await supabase
      .from('timer_state')
      .update({
        status: nextStatus,
        remaining_seconds: nextRemaining,
        updated_at: now
      })
      .eq('id', 1)
      .select()
      .single();

    if (updateError) {
      console.error('Update timer error:', updateError);
      return NextResponse.json({ error: 'Failed to update timer' }, { status: 500 });
    }

    return NextResponse.json({ success: true, timerState: updatedState });
  } catch (error) {
    console.error('Timer action error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
