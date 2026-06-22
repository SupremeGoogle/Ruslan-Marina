const fs = require('fs');
const path = require('path');

async function main() {
  // Let's test a Supabase storage URL from the database check
  const url = 'https://terdvsvekqxlyakharno.supabase.co/storage/v1/object/public/photos/eed2a231-5f28-465c-9f64-4ba7ae46b3ec/1782132809953_80be9.png';
  console.log(`Testing storage URL: ${url}`);
  try {
    const res = await fetch(url, { method: 'HEAD' });
    console.log(`Status: ${res.status} ${res.statusText}`);
    console.log('Headers:', Object.fromEntries(res.headers.entries()));
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}

main().catch(console.error);
