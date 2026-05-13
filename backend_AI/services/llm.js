const Groq = require('groq-sdk');

/**
 * Call Groq API (llama-3.3-70b-versatile) with native tool support.
 * Required in your .env:
 *   GROQ_API_KEY=xxxxxxxxxxxxxxxxxxxx
 */
async function callGroq(messages, tools = []) {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const systemMsg = messages.find(m => m.role === 'system');
    const conversationMsgs = messages
      .filter(m => m.role !== 'system')
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

    const groqTools = tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters,
          required: tool.required || []
        }
      }
    }));

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1200,
      temperature: 0.2,
      messages: [
        ...(systemMsg ? [{ role: 'system', content: systemMsg.content }] : []),
        ...conversationMsgs
      ],
      ...(groqTools.length > 0 && {
        tools: groqTools,
        tool_choice: 'auto'
      })
    });

    const choice = response.choices[0];

    // Tool call requested by Groq
    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length > 0) {
      const toolCall = choice.message.tool_calls[0];
      return {
        reply: '',
        toolCall: {
          name: toolCall.function.name,
          args: JSON.parse(toolCall.function.arguments)
        }
      };
    }

    return { reply: choice.message.content || '', toolCall: null };

  } catch (error) {
    console.error('Groq API error:', error.message);
    return {
      reply: JSON.stringify({
        message: 'Groq API unavailable. Check your GROQ_API_KEY.',
        type: 'general',
        actions: ['Passenger Rights', 'Alternative Flights', 'Airport Services']
      }),
      toolCall: null
    };
  }
}

async function chat(messages, tools = []) {
  return await callGroq(messages, tools);
}

function getProvider() {
  return 'groq';
}

module.exports = { chat, getProvider };
