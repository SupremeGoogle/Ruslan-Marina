import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/utils/supabaseClient';
import JSZip from 'jszip';

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

    // Helper: Ensure the storage bucket exists
    const ensureBucketExists = async () => {
      const { data: buckets } = await supabase.storage.listBuckets();
      const exists = buckets?.some((b: any) => b.id === BUCKET_NAME);
      if (!exists) {
        await supabase.storage.createBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: 104857600 // 100MB
        });
      }
    };

    if (action === 'create') {
      await ensureBucketExists();

      // 1. Fetch all photo records
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

      // Download each image and append it to the zip file
      const downloadPromises = photos.map(async (photo: any, idx: number) => {
        try {
          const response = await fetch(photo.url);
          if (!response.ok) throw new Error(`HTTP error ${response.status}`);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Get file extension from URL or fallback
          let ext = 'jpg';
          const urlPath = new URL(photo.url).pathname;
          const match = urlPath.match(/\.([a-zA-Z0-9]+)(?:[\?#]|$)/);
          if (match && match[1]) {
            ext = match[1];
          }

          // Safe filename prefix: replace Cyrillic/spaces or use guest_name
          const safeName = photo.guest_name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
          const fileName = `${idx + 1}_${safeName}_${photo.id.substring(0, 5)}.${ext}`;

          zip.file(fileName, buffer);
        } catch (err) {
          console.error(`Failed to download image ${photo.url}:`, err);
        }
      });

      await Promise.all(downloadPromises);

      // 3. Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // 4. Upload ZIP buffer to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(ARCHIVE_FILENAME, zipBuffer, {
          contentType: 'application/zip',
          upsert: true,
        });

      if (uploadError) {
        console.error('Error uploading zip archive:', uploadError);
        return NextResponse.json({ error: 'Failed to upload zip archive' }, { status: 500 });
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(ARCHIVE_FILENAME);

      return NextResponse.json({ success: true, archiveUrl: publicUrl });
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
