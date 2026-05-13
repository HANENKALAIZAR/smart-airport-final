require('dotenv').config();

const KEY = process.env.AVIATION_EDGE_KEY;
const FLIGHT = 'TO8153';

async function test() {
  console.log(`Key: ${KEY}\n`);

  // Try all possible parameter name variations
  const paramVariants = [
    `flightIata=${FLIGHT}`,
    `flight_iata=${FLIGHT}`,
    `flightNum=${FLIGHT}`,
    `flight=${FLIGHT}`,
    `iataNumber=${FLIGHT}`,
  ];

  for (const param of paramVariants) {
    const url = `https://aviation-edge.com/v2/public/timetable?key=${KEY}&iataCode=MIR&type=departure&${param}`;
    console.log(`\nTrying: ${param}`);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const json = await res.json();
      if (Array.isArray(json)) {
        console.log(`  -> Array with ${json.length} items`);
        const match = json.find(f => JSON.stringify(f).includes('TO8153') || JSON.stringify(f).includes('8153'));
        if (match) console.log('  ✅ FOUND TO8153:', JSON.stringify(match).substring(0, 300));
        else console.log('  -> First flight:', json[0]?.flight?.iataNumber || 'none');
      } else {
        console.log(`  -> Response:`, JSON.stringify(json).substring(0, 200));
      }
    } catch(e) { console.error('  Error:', e.message); }
  }

  // Also try without airport filter
  console.log('\n--- Without iataCode filter ---');
  const url2 = `https://aviation-edge.com/v2/public/timetable?key=${KEY}&type=departure&flightIata=${FLIGHT}`;
  console.log('URL:', url2);
  try {
    const res = await fetch(url2, { signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    console.log('Response:', JSON.stringify(json).substring(0, 400));
  } catch(e) { console.error('Error:', e.message); }
}

test();
