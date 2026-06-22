const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read .env.local keys
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local file not found at', envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`${name}=(.*)`));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// High-quality wedding photos from Unsplash
const unsplashPhotos = [
  // Couple / Bride and Groom
  'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507504038482-76210374c276?w=800&auto=format&fit=crop&q=80',
  
  // Rings / Details
  'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519225495810-7512c696505a?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1546032994-dd20b39459a7?w=800&auto=format&fit=crop&q=80',
  
  // Table / Cake / Flowers
  'https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&auto=format&fit=crop&q=80',
  
  // Extra beautiful wedding moments
  'https://images.unsplash.com/photo-1472653425572-4fcca29fb01a?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519225495810-7512c696505a?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1525253086316-d0c936c814f8?w=800&auto=format&fit=crop&q=80'
];

const mockGuests = [
  { first_name: 'Алексей', last_name: 'Смирнов', ip_address: '82.200.34.12' },
  { first_name: 'Елена', last_name: 'Петрова', ip_address: '178.45.109.81' },
  { first_name: 'Михаил', last_name: 'Кузнецов', ip_address: '94.25.188.42' },
  { first_name: 'Ольга', last_name: 'Соколова', ip_address: '46.160.31.25' }
];

async function seedData() {
  console.log('Seeding mock wedding guests and photos into Supabase...');

  // Create guests
  const createdGuests = [];
  for (const g of mockGuests) {
    // Check if guest already exists to avoid duplicates
    const { data: existing } = await supabase
      .from('guests')
      .select('*')
      .eq('first_name', g.first_name)
      .eq('last_name', g.last_name)
      .maybeSingle();

    if (existing) {
      console.log(`Guest ${g.first_name} ${g.last_name} already exists.`);
      createdGuests.push(existing);
    } else {
      const { data: created, error } = await supabase
        .from('guests')
        .insert(g)
        .select()
        .single();
      
      if (error) {
        console.error('Error inserting guest:', error.message);
      } else {
        console.log(`Created guest: ${created.first_name} ${created.last_name}`);
        createdGuests.push(created);
      }
    }
  }

  // Insert 5 photos for each guest
  let photoIndex = 0;
  for (const guest of createdGuests) {
    // Check current count of photos for this guest
    const { count } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('guest_id', guest.id);

    if (count && count >= 5) {
      console.log(`Guest ${guest.first_name} already has ${count} photos. Skipping photo seed.`);
      photoIndex += 5;
      continue;
    }

    const startIdx = photoIndex;
    const endIdx = startIdx + 5;
    const photosToInsert = unsplashPhotos.slice(startIdx, endIdx);

    for (let i = 0; i < photosToInsert.length; i++) {
      const url = photosToInsert[i];
      const { error } = await supabase
        .from('photos')
        .insert({
          guest_id: guest.id,
          guest_name: `${guest.first_name} ${guest.last_name}`,
          url: url,
          storage_path: `seed_${guest.id}_${i + 1}.jpg`
        });

      if (error) {
        console.error(`Error inserting photo for ${guest.first_name}:`, error.message);
      }
    }
    console.log(`Seeded 5 photos for ${guest.first_name} ${guest.last_name}`);
    photoIndex += 5;
  }

  console.log('\nDatabase seeding completed successfully! The gallery is populated.');
}

seedData().catch(console.error);
