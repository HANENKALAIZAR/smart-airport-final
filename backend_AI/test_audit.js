
async function testChat(message, sessionId) {
  try {
    const res = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId })
    });
    const data = await res.json();
    console.log(`\n--- USER: ${message}`);
    const parsed = typeof data.reply === "string" ? JSON.parse(data.reply) : data.reply;
    console.log(JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.log(`\n--- USER: ${message} => ERROR`);
    console.error(err);
  }
}

async function run() {
  await testChat("Alternative flights to Paris", "s1");
  await testChat("Find me another flight", "s2");
  await testChat("My flight TU706 is delayed, suggest alternatives", "s3");
  await testChat("My flight TU706 is cancelled, what alternatives do I have?", "s4"); // using flight number to avoid prompt loop
  await testChat("TU706 alternatives and my rights", "s5");
}

run();
