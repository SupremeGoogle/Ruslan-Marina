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
  const { data: timerState, error } = await supabase.from('timer_state').select('*');
  if (error) {
    console.error('Error fetching timer state:', error);
    return;
  }
  console.log('Timer State in DB:', timerState);
}

main().catch(console.error);
