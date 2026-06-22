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
  console.log('Testing anon upload to photos bucket...');
  const testBuffer = Buffer.from('test-image-content');
  const fileName = `test_anon_${Date.now()}.txt`;
  
  const { data, error } = await supabase.storage
    .from('photos')
    .upload(fileName, testBuffer, {
      contentType: 'text/plain',
      upsert: true
    });

  if (error) {
    console.error('Anon upload FAILED:', error);
  } else {
    console.log('Anon upload SUCCESS:', data);
    // Cleanup
    await supabase.storage.from('photos').remove([fileName]);
  }
}

main().catch(console.error);
