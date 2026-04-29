require('dotenv').config();
const { chat } = require('./services/llm');
const tests = [
    "My flight TU741 is delayed, what are my rights?",
    "Are there alternative flights for TU741?",
    "What hotels are near Tunis airport?",
    "What restaurants are at CDG airport?"
];

async function runTests() {
    console.log('🧪 Testing Groq integration...\n');
    console.log('Provider:', process.env.LLM_PROVIDER);
    console.log('─'.repeat(50));

    for (const question of tests) {
        console.log(`\n👤 Passenger: ${question}`);

        try {
            const result = await chat([
                { role: 'system', content: 'You are a helpful passenger assistant.' },
                { role: 'user', content: question }
            ]);

            if (result.toolCall) {
                console.log(`🔧 Tool called: ${result.toolCall.name}`);
                console.log(`   Args:`, result.toolCall.args);
            } else {
                console.log(`🤖 Groq reply: ${result.reply.slice(0, 120)}...`);
            }
        } catch (err) {
            console.error(`❌ Failed: ${err.message}`);
        }

        console.log('─'.repeat(50));
    }
}

runTests();