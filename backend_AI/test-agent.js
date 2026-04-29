require('dotenv').config();
const { runAgent } = require('./services/agent');

const SESSION = 'test-session-1';

async function ask(question) {
    console.log(`\n👤 "${question}"`);
    const result = await runAgent(question, [], SESSION);
    const parsed = JSON.parse(result.reply);
    console.log(`🤖 Type: ${parsed.type}`);
    console.log(`💬 Message: ${parsed.message}`);
    if (parsed.rights) console.log(`⚖️  Rights:`, parsed.rights.map(r => r.title));
    if (parsed.flights) console.log(`✈️  Flights:`, parsed.flights.map(f => f.flightNumber));
    if (parsed.hotels) console.log(`🏨 Hotels:`, parsed.hotels?.slice(0, 2).map(h => h.name));
    console.log('─'.repeat(60));
}

async function main() {
    console.log('🧪 Testing full agent with Groq + real services\n');
    console.log('Provider:', process.env.LLM_PROVIDER);
    console.log('─'.repeat(60));

    await ask('My flight TU741 is delayed, what are my rights?');
    await ask('Are there alternative flights for TU741?');
    await ask('What hotels are near the airport?');
}

main().catch(console.error);