async function main() {
  const url = 'https://ruslan-marina.vercel.app/api/admin/timer';
  const password = 'akbar123!';
  
  console.log(`Testing Vercel Admin Timer API with password: ${password}`);
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': password,
      },
      body: JSON.stringify({ action: 'start' }),
    });
    
    console.log(`Response Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log('Response Body:', data);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

main().catch(console.error);
