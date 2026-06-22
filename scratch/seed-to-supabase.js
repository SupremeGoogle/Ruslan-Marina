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
  
  // Clean photos database
  const { error: deletePhotosError } = await supabase.from('photos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deletePhotosError) console.error('Error clearing photos:', deletePhotosError);

  // Clean guests database
  const { error: deleteGuestsError } = await supabase.from('guests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deleteGuestsError) console.error('Error clearing guests:', deleteGuestsError);

  // Clean existing photos storage bucket files if possible
  console.log('Listing storage bucket files...');
  const { data: storageFiles } = await supabase.storage.from('photos').list();
  if (storageFiles && storageFiles.length > 0) {
    const pathsToDelete = storageFiles.map(f => f.name);
    console.log(`Deleting ${pathsToDelete.length} files from photos storage bucket...`);
    await supabase.storage.from('photos').remove(pathsToDelete);
  }

  // Pre-download 10 high-quality random images to memory
  console.log('\nPre-downloading 10 sample images to memory...');
  const imageBuffers = [];
  for (let i = 0; i < 10; i++) {
    const isLandscape = i % 2 === 0;
    const width = isLandscape ? 800 : 600;
    const height = isLandscape ? 600 : 800;
    const url = `https://picsum.photos/${width}/${height}?random=${i}`;
    try {
      console.log(`Downloading sample ${i + 1}/10...`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      imageBuffers.push({
        buffer: Buffer.from(arrayBuffer),
        contentType: 'image/jpeg'
      });
    } catch (err) {
      console.error(`Failed to download sample ${i}:`, err);
    }
  }

  if (imageBuffers.length === 0) {
    console.error('Failed to download any sample images. Seeding cancelled.');
    process.exit(1);
  }
  console.log(`Successfully loaded ${imageBuffers.length} images into memory.`);

  console.log('\nSeeding 18 guests...');
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

  console.log(`Successfully created ${createdGuests.length} guests in database.`);
  console.log('\nUploading photos to Supabase Storage and inserting into database...');

  // Photo distribution:
  // - 10 guests with 5 photos
  // - 5 guests with 2-4 photos
  // - 3 guests with 0 photos
  for (let idx = 0; idx < createdGuests.length; idx++) {
    const guest = createdGuests[idx];
    let photoCount = 0;
    
    if (idx < 10) {
      photoCount = 5;
    } else if (idx < 15) {
      photoCount = 2 + (idx % 3);
    } else {
      photoCount = 0;
    }

    const name = `${guest.first_name} ${guest.last_name}`;
    console.log(`Uploading ${photoCount} photos for ${name}...`);

    for (let p = 0; p < photoCount; p++) {
      // Pick one of the downloaded images from our memory pool
      const imageIndex = (idx * 5 + p) % imageBuffers.length;
      const { buffer, contentType } = imageBuffers[imageIndex];
      
      const fileName = `seed/${guest.id}/${Date.now()}_${p}_${Math.random().toString(36).substring(2, 7)}.jpg`;

      // 1. Upload to Supabase Storage photos bucket
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, buffer, {
          contentType: contentType,
          upsert: true
        });

      if (uploadError) {
        console.error(`Failed to upload ${fileName} for ${name}:`, uploadError.message);
        continue;
      }

      // 2. Get public URL of the uploaded image
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      // 3. Insert record into database photos table
      const { error: dbError } = await supabase
        .from('photos')
        .insert({
          guest_id: guest.id,
          guest_name: name,
          url: publicUrl,
          storage_path: fileName
        });

      if (dbError) {
        console.error(`Failed to insert database record for ${name}:`, dbError.message);
      }
    }
  }

  console.log('\nSeeding completed successfully! All photos are now natively hosted on Supabase Storage.');
}

seedData().catch(console.error);
