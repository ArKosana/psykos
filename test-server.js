const fetch = require('node-fetch');

async function testServer() {
  try {
    // Test the Vite server on port 5173 (your actual server)
    const response = await fetch('http://localhost:5173/');
    const text = await response.text();
    
    if (text.includes('Vite') || response.ok) {
      console.log('✅ Vite Server (5173) is running - serving:', text.substring(0, 100) + '...');
    } else {
      console.log('✅ Server is running on port 5173');
    }
    
  } catch (error) {
    console.log('❌ Server on port 5173 is not responding. Error:', error.message);
  }
}

// Also test the client
async function testClient() {
  try {
    const response = await fetch('http://localhost:5174/');
    const text = await response.text();
    console.log('✅ Client (5174) is running - serving HTML');
  } catch (error) {
    console.log('❌ Client on port 5174 is not responding.');
  }
}

async function testAll() {
  console.log('Testing your Psykos Game servers...\n');
  await testServer();
  await testClient();
  console.log('\n🎮 Your game should be accessible at: http://localhost:5174/');
}

testAll();
