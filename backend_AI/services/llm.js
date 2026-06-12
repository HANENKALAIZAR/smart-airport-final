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
      .map(msg => {
        if (msg.role === 'tool') {
          return {
            role: 'tool',
            tool_call_id: msg.tool_call_id,
            content: msg.content
          };
        }
        if (msg.role === 'assistant' && msg.tool_calls) {
          return {
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.tool_calls
          };
        }
        return {
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        };
      });

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

    // Tool call requested by Groq (possibly multiple in parallel)
    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length > 0) {
      const toolCalls = choice.message.tool_calls.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments)
      }));
      return {
        reply: choice.message.content || '',
        toolCalls
      };
    }

    return { reply: choice.message.content || '', toolCalls: null };

  } catch (error) {
    console.error('Groq API error:', error.message);
    // Determine a friendly message based on error type — never expose internals
    const errorMsg = error.message || '';
    let friendlyMessage;
    if (errorMsg.startsWith('429')) {
      friendlyMessage = 'Our assistant is currently busy. Please wait a moment and try again.';
    } else if (errorMsg.startsWith('401') || errorMsg.startsWith('403')) {
      friendlyMessage = 'Our assistant is temporarily unavailable. Please contact support.';
    } else {
      friendlyMessage = 'Our assistant is temporarily unavailable. Please try again in a few moments.';
    }
    return {
      reply: JSON.stringify({
        message: friendlyMessage,
        type: 'general',
        actions: ['Flight Status', 'Airport Services', 'Passenger Rights']
      }),
      toolCalls: null
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
