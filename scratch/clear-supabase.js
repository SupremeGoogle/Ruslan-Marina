const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local file not found');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`${name}=(.*)`));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('--- Database & Storage Cleanup Initiated ---');

  // 1. Fetch all photos to get their storage paths
  console.log('Fetching photos to identify storage files...');
  const { data: photos, error: photosError } = await supabase.from('photos').select('storage_path');
  if (photosError) {
    console.error('Error fetching photos:', photosError);
  }

  // 2. Delete files from Supabase Storage
  if (photos && photos.length > 0) {
    const paths = photos.map(p => p.storage_path);
    console.log(`Deleting ${paths.length} files from Supabase Storage...`);
    const { error: storageError } = await supabase.storage.from('photos').remove(paths);
    if (storageError) {
      console.error('Error deleting storage files:', storageError);
    } else {
      console.log('Successfully cleared all files from Supabase Storage.');
    }
  } else {
    console.log('No files found in Supabase Storage.');
  }

  // 3. Delete all guests (cascade will delete all database photo entries)
  console.log('Deleting all guests from the database (cascade deletes photos)...');
  const { data: deleteGuests, error: guestsError } = await supabase
    .from('guests')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything
  
  if (guestsError) {
    console.error('Error deleting guests:', guestsError);
  } else {
    console.log('Successfully deleted all guests and database photo records.');
  }

  // 4. Reset the timer state to 'reset'
  console.log('Resetting timer state...');
  const { error: timerError } = await supabase
    .from('timer_state')
    .update({
      status: 'reset',
      remaining_seconds: 10800,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1);

  if (timerError) {
    console.error('Error resetting timer state:', timerError);
  } else {
    console.log('Successfully reset timer to 03:00:00 (reset).');
  }

  console.log('--- Cleanup Finished ---');
}

main().catch(console.error);
