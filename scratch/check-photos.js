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
  const { data: photos, error } = await supabase.from('photos').select('*');
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log(`Found ${photos.length} photos in DB:`);
  photos.forEach(p => {
    console.log(`- ID: ${p.id}, Guest: ${p.guest_name}, URL: ${p.url}`);
  });
}

main().catch(console.error);
