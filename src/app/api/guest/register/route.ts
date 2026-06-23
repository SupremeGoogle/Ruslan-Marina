import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/utils/supabaseClient';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
    const ip = typeof body.ip === 'string' ? body.ip : null;

    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'Missing firstName or lastName' }, { status: 400 });
    }

    const supabase = createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
    }

    // Reuse existing guest if a row with the same name already exists.
    const { data: existing, error: findError } = await supabase
      .from('guests')
      .select('id, first_name, last_name, ip_address')
      .eq('first_name', firstName)
      .eq('last_name', lastName)
      .maybeSingle();

    if (findError) {
      console.error('Guest lookup error:', findError);
      return NextResponse.json({ error: 'Database lookup failed' }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({
        success: true,
        guest: {
          id: existing.id,
          firstName: existing.first_name,
          lastName: existing.last_name,
          ip: existing.ip_address ?? ip,
        },
      });
    }

    const { data: created, error: createError } = await supabase
      .from('guests')
      .insert({ first_name: firstName, last_name: lastName, ip_address: ip })
      .select()
      .single();

    if (createError || !created) {
      console.error('Guest insert error:', createError);
      return NextResponse.json({ error: 'Failed to register guest' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      guest: {
        id: created.id,
        firstName: created.first_name,
        lastName: created.last_name,
        ip: created.ip_address ?? ip,
      },
    });
  } catch (error) {
    console.error('Guest register error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
