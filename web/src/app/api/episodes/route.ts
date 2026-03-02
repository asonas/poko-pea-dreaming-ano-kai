import { NextResponse } from 'next/server';
import { createServerSupabaseClient, Episode } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('episodes')
      .select('id, title, episode_number, upload_date, duration_seconds')
      .order('upload_date', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch episodes' },
        { status: 500 }
      );
    }

    const episodes: Episode[] = data || [];

    return NextResponse.json({ episodes }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Episodes fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
