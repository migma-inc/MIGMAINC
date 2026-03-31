
const clientId = '212';
const clientSecret = 'aivk8oGKuCkgFk0e3zl1fTNyEdAbu5ovR2EyH3kL';
const tokenUrl = 'https://sandbox.parcelow.com/oauth/token';

async function testAuth() {
    console.log('Testing Parcelow Auth...');

    // Test 1: JSON format
    console.log('\n--- Test 1: JSON format ---');
    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: parseInt(clientId),
                client_secret: clientSecret,
                grant_type: 'client_credentials',
            }),
        });
        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Body: ${text}`);
    } catch (e) {
        console.error('Error:', e);
    }

    // Test 2: Form URL Encoded
    console.log('\n--- Test 2: Form URL Encoded ---');
    try {
        const params = new URLSearchParams();
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret);
        params.append('grant_type', 'client_credentials');

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
            body: params.toString(),
        });
        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Body: ${text}`);
    } catch (e) {
        console.error('Error:', e);
    }
}

testAuth();
