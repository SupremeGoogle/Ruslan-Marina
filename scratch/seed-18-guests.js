const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read .env.local keys
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

const mock18Guests = [
  { first_name: 'Александр', last_name: 'Иванов', ip_address: '195.24.88.12' },
  { first_name: 'Мария', last_name: 'Петрова', ip_address: '178.46.12.94' },
  { first_name: 'Дмитрий', last_name: 'Сидоров', ip_address: '94.25.188.42' },
  { first_name: 'Анна', last_name: 'Кузнецова', ip_address: '46.160.31.25' },
  { first_name: 'Сергей', last_name: 'Смирнов', ip_address: '82.200.34.12' },
  { first_name: 'Елена', last_name: 'Васильева', ip_address: '188.162.4.55' },
  { first_name: 'Андрей', last_name: 'Попов', ip_address: '95.54.22.106' },
  { first_name: 'Ольга', last_name: 'Соколова', ip_address: '176.59.32.19' },
  { first_name: 'Роман', last_name: 'Морозов', ip_address: '77.82.100.22' },
  { first_name: 'Наталья', last_name: 'Новикова', ip_address: '80.252.130.6' },
  { first_name: 'Артем', last_name: 'Федоров', ip_address: '213.87.120.45' },
  { first_name: 'Юлия', last_name: 'Козлова', ip_address: '109.252.80.34' },
  { first_name: 'Максим', last_name: 'Лебедев', ip_address: '185.15.60.111' },
  { first_name: 'Татьяна', last_name: 'Егорова', ip_address: '91.200.40.82' },
  { first_name: 'Владислав', last_name: 'Волков', ip_address: '46.188.90.15' },
  { first_name: 'Екатерина', last_name: 'Павлова', ip_address: '178.64.210.190' },
  { first_name: 'Денис', last_name: 'Степанов', ip_address: '185.120.30.22' },
  { first_name: 'Ирина', last_name: 'Семенова', ip_address: '92.37.142.60' }
];

async function seedData() {
  console.log('Cleaning existing database entries to ensure a clean seed...');
  
  // Clean photos first (foreign key constraints)
  const { error: deletePhotosError } = await supabase.from('photos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deletePhotosError) console.error('Error clearing photos:', deletePhotosError);

  // Clean guests
  const { error: deleteGuestsError } = await supabase.from('guests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deleteGuestsError) console.error('Error clearing guests:', deleteGuestsError);

  console.log('Seeding 18 guests...');
  const createdGuests = [];
  for (const g of mock18Guests) {
    const { data: created, error } = await supabase
      .from('guests')
      .insert(g)
      .select()
      .single();
    
    if (error) {
      console.error(`Error creating guest ${g.first_name} ${g.last_name}:`, error.message);
    } else {
      createdGuests.push(created);
    }
  }

  console.log(`Successfully created ${createdGuests.length} guests. Inserting photos...`);

  // To make the demo realistic:
  // - 10 guests will have 5 photos (completed).
  // - 5 guests will have 2-4 photos (in progress).
  // - 3 guests will have 0 photos (just registered).
  let photoIndex = 1;
  for (let idx = 0; idx < createdGuests.length; idx++) {
    const guest = createdGuests[idx];
    let photoCount = 0;
    
    if (idx < 10) {
      photoCount = 5; // 5 photos
    } else if (idx < 15) {
      photoCount = 2 + (idx % 3); // 2, 3 or 4 photos
    } else {
      photoCount = 0; // 0 photos
    }

    const name = `${guest.first_name} ${guest.last_name}`;
    console.log(`Seeding ${photoCount} photos for ${name}...`);

    for (let p = 0; p < photoCount; p++) {
      // Use standard picsum photos with varying IDs
      // Adding varying dimensions or aspect ratios for realistic adaptive collage layout testing
      const idNum = (photoIndex * 17) % 1000 + 10;
      const width = p % 2 === 0 ? 800 : 600;
      const height = p % 2 === 0 ? 600 : 800;
      const url = `https://picsum.photos/id/${idNum}/${width}/${height}`;

      const { error } = await supabase
        .from('photos')
        .insert({
          guest_id: guest.id,
          guest_name: name,
          url: url,
          storage_path: `seed_${guest.id}_${p}.jpg`
        });

      if (error) {
        console.error(`Error inserting photo for ${name}:`, error.message);
      }
      photoIndex++;
    }
  }

  console.log('\nDatabase seeding of 18 guests completed successfully!');
}

seedData().catch(console.error);
