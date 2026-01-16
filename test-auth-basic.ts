
const clientId = '212';
const clientSecret = 'aivk8oGKuCkgFk0e3zl1fTNyEdAbu5ovR2EyH3kL';
const tokenUrl = 'https://sandbox.parcelow.com/oauth/token';

async function testAuth() {
  console.log('Testing Parcelow Auth...');
  
  // Test 3: Basic Auth
  console.log('\n--- Test 3: Basic Auth ---');
  try {
    const authString = btoa(`${clientId}:${clientSecret}`);
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json',
      },
      body: 'grant_type=client_credentials',
    });
    console.log(`Status: ${response.status}`);
    const text = await response.text();
    console.log(`Body: ${text}`);
  } catch (e) {
    console.error('Error:', e);
  }
}

testAuth();
