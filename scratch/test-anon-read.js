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
  console.log('Testing anon access to guests table...');
  const { data: guests, error: guestsError } = await supabase.from('guests').select('*');
  if (guestsError) {
    console.error('Guests read error:', guestsError);
  } else {
    console.log(`Successfully read ${guests.length} guests.`);
  }

  console.log('Testing anon access to photos table...');
  const { data: photos, error: photosError } = await supabase.from('photos').select('*');
  if (photosError) {
    console.error('Photos read error:', photosError);
  } else {
    console.log(`Successfully read ${photos.length} photos.`);
    if (photos.length > 0) {
      console.log('Sample photo:', photos[0]);
    }
  }
}

main().catch(console.error);
