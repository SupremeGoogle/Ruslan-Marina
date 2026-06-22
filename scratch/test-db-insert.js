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
const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('Testing anon insert to photos table...');
  
  // Try to find a guest first to get a valid guest_id
  const { data: guests, error: guestsError } = await supabase.from('guests').select('id').limit(1);
  if (guestsError || !guests || guests.length === 0) {
    console.error('Could not fetch guest for testing:', guestsError);
    return;
  }
  
  const guestId = guests[0].id;
  console.log(`Using guest_id: ${guestId}`);

  const { data, error } = await supabase
    .from('photos')
    .insert({
      guest_id: guestId,
      guest_name: 'Test Anon Guest',
      url: 'https://example.com/test.jpg',
      storage_path: 'test/path.jpg'
    })
    .select();

  if (error) {
    console.error('Anon insert FAILED:', error);
  } else {
    console.log('Anon insert SUCCESS:', data);
    
    // Cleanup
    const { error: deleteError } = await supabase
      .from('photos')
      .delete()
      .eq('id', data[0].id);
    if (deleteError) {
      console.error('Cleanup failed:', deleteError);
    } else {
      console.log('Cleanup successful.');
    }
  }
}

main().catch(console.error);
