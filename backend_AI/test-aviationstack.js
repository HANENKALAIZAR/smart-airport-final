require('dotenv').config();

const KEY = process.env.AVIATIONSTACK_KEY;
const FLIGHT = 'TO8153';

async function test() {
  console.log(`\n🔑 AviationStack Key: ${KEY ? KEY.substring(0, 8) + '...' : 'MISSING'}\n`);

  // AviationStack real-time flights
  try {
    const url = `http://api.aviationstack.com/v1/flights?access_key=${KEY}&flight_iata=${FLIGHT}`;
    console.log('URL:', url);
    const res = await fetch(url);
    const json = await res.json();
    if (json.data && json.data.length > 0) {
      console.log('✅ FOUND! Flight data:');
      console.log(JSON.stringify(json.data[0], null, 2).substring(0, 1000));
    } else {
      console.log('❌ Not found in real-time.');
      console.log('Full response:', JSON.stringify(json).substring(0, 500));
    }
  } catch (e) { console.error('Error:', e.message); }

  // AviationStack timetable / schedules
  try {
    const url = `http://api.aviationstack.com/v1/flightsFuture?access_key=${KEY}&flight_iata=${FLIGHT}&type=departure`;
    console.log('\nURL (future):', url);
    const res = await fetch(url);
    const json = await res.json();
    if (json.data && json.data.length > 0) {
      console.log('✅ FOUND in future schedules!');
      console.log(JSON.stringify(json.data[0], null, 2).substring(0, 800));
    } else {
      console.log('❌ Not in future schedules.');
      console.log('Response:', JSON.stringify(json).substring(0, 300));
    }
  } catch (e) { console.error('Error:', e.message); }
}

test();
