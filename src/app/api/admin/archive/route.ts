import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/utils/supabaseClient';
import JSZip from 'jszip';

// Vercel function timeout: archiving 100+ photos through Supabase can take
// >10s, so request the full 60s budget available on Hobby / 300s on Pro.
export const maxDuration = 60;
export const runtime = 'nodejs';

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
      return NextResponse.json({ error: 'Database client not initialized' }, { status: 503 });
    }

    const ARCHIVE_FILENAME = 'all_wedding_photos.zip';
    const BUCKET_NAME = 'archives';

    // Helper: Ensure the storage bucket exists. Returns { ok, error } so the
    // caller can surface a clear message instead of failing silently later.
    const ensureBucketExists = async (): Promise<{ ok: boolean; error?: string }> => {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      if (listError) {
        return { ok: false, error: `listBuckets: ${listError.message}` };
      }
      const exists = buckets?.some((b: any) => b.id === BUCKET_NAME);
      if (exists) return { ok: true };

      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 524288000, // 500MB cap for the archive blob
      });
      if (createError) {
        // Race-condition: a parallel call may have already created it.
        const { data: postBuckets } = await supabase.storage.listBuckets();
        const nowExists = postBuckets?.some((b: any) => b.id === BUCKET_NAME);
        if (nowExists) return { ok: true };
        return { ok: false, error: `createBucket: ${createError.message}` };
      }
      return { ok: true };
    };

    if (action === 'create') {
      const bucketState = await ensureBucketExists();
      if (!bucketState.ok) {
        console.error('ensureBucketExists failed:', bucketState.error);
        return NextResponse.json(
          { error: `Не удалось подготовить bucket архива: ${bucketState.error}. Создайте bucket "archives" вручную в Supabase Storage (Public).` },
          { status: 500 }
        );
      }

      // 1. Fetch all photo records (downloading bytes from the URL works even
      // if the photos bucket itself has tight policies, because URLs are
      // public).
      const { data: photos, error: fetchError } = await supabase
        .from('photos')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching photos for archive:', fetchError);
        return NextResponse.json({ error: 'Failed to fetch photos list' }, { status: 500 });
      }

      if (!photos || photos.length === 0) {
        return NextResponse.json({ error: 'No photos uploaded yet to archive' }, { status: 400 });
      }

      // 2. Initialize JSZip
      const zip = new JSZip();
      const failures: string[] = [];

      // Download photos with limited concurrency so we don't overwhelm
      // Supabase or run out of memory in the serverless function.
      const CONCURRENCY = 6;
      let cursor = 0;
      const workers = Array.from({ length: CONCURRENCY }).map(async () => {
        while (true) {
          const idx = cursor++;
          if (idx >= photos.length) return;
          const photo: any = photos[idx];
          try {
            // Prefer pulling bytes from Storage via the service client (no
            // public URL roundtrip). Fall back to public URL fetch.
            let buffer: Buffer | null = null;
            if (photo.storage_path) {
              const { data: blob, error: dlError } = await supabase.storage
                .from('photos')
                .download(photo.storage_path);
              if (!dlError && blob) {
                buffer = Buffer.from(await blob.arrayBuffer());
              }
            }
            if (!buffer) {
              const response = await fetch(photo.url);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              buffer = Buffer.from(await response.arrayBuffer());
            }

            let ext = 'jpg';
            try {
              const urlPath = new URL(photo.url).pathname;
              const match = urlPath.match(/\.([a-zA-Z0-9]+)(?:[\?#]|$)/);
              if (match && match[1]) ext = match[1];
            } catch {/* ignore */}

            const safeName = String(photo.guest_name || 'guest').replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
            const fileName = `${String(idx + 1).padStart(3, '0')}_${safeName}_${String(photo.id).substring(0, 5)}.${ext}`;
            zip.file(fileName, buffer);
          } catch (err) {
            console.error(`Failed to fetch photo ${photo.url}:`, err);
            failures.push(photo.id);
          }
        }
      });

      await Promise.all(workers);

      // 3. Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'STORE', // photos are already JPEG-compressed
      });

      // 4. Upload ZIP buffer to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(ARCHIVE_FILENAME, zipBuffer, {
          contentType: 'application/zip',
          upsert: true,
        });

      if (uploadError) {
        console.error('Error uploading zip archive:', uploadError);
        return NextResponse.json(
          { error: `Не удалось загрузить ZIP в bucket "${BUCKET_NAME}": ${uploadError.message}` },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(ARCHIVE_FILENAME);

      return NextResponse.json({
        success: true,
        archiveUrl: publicUrl,
        photoCount: photos.length,
        failed: failures.length,
      });
    }

    if (action === 'delete') {
      await ensureBucketExists();

      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([ARCHIVE_FILENAME]);

      if (deleteError) {
        console.error('Error deleting zip archive:', deleteError);
        return NextResponse.json({ error: 'Failed to delete zip archive' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'check') {
      await ensureBucketExists();

      // Check if file exists in the list
      const { data: files, error: listError } = await supabase.storage
        .from(BUCKET_NAME)
        .list();

      if (listError) {
        return NextResponse.json({ exists: false });
      }

      const fileExists = files?.some((f: any) => f.name === ARCHIVE_FILENAME);
      if (fileExists) {
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(ARCHIVE_FILENAME);
        return NextResponse.json({ exists: true, archiveUrl: publicUrl });
      } else {
        return NextResponse.json({ exists: false });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Archive action error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
