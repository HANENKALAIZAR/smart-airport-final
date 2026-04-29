const Anthropic = require('@anthropic-ai/sdk');

// Provider: 'ollama' or 'claude'
const provider = process.env.LLM_PROVIDER || 'ollama';
// add this line next to your existing Anthropic require
const Groq = require('groq-sdk');
/**
 * Call Ollama API with Llama3
 * Llama3 does NOT support native tool calling — we use JSON-mode prompt engineering
 */
async function callOllama(messages, tools = []) {
  try {
    // Enforce JSON output: inject a reminder as the last system turn
    const messagesWithJsonEnforcement = messages.map(msg => {
      if (msg.role === 'system') {
        return {
          ...msg,
          content: msg.content + '\n\nCRITICAL INSTRUCTION: You MUST respond with valid JSON ONLY. No text before or after. No markdown. No ```json``` blocks. Start your response with { and end with }.'
        };
      }
      return msg;
    });

    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        messages: messagesWithJsonEnforcement,
        stream: false,
        format: 'json', // Force Ollama JSON mode
        options: {
          temperature: 0.1, // Lower = more deterministic JSON output
          num_predict: 1200,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    let reply = data.message?.content || '';

    // Strip any accidental markdown code fences
    reply = reply.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    return { reply, toolCall: null };

  } catch (error) {
    console.error('Ollama API error:', error.message);

    // Ollama not running — provide a structured fallback
    const lastMsg = messages[messages.length - 1]?.content || '';
    const flightMatch = lastMsg.match(/([A-Z]{1,2}\d{3,4})/i);

    if (flightMatch) {
      return {
        reply: JSON.stringify({
          message: `Looking up flight ${flightMatch[1].toUpperCase()}... (Ollama not reachable, using fallback)`,
          type: 'general',
          actions: ['Passenger Rights', 'Alternative Flights', 'Airport Services']
        }),
        toolCall: null
      };
    }

    return {
      reply: JSON.stringify({
        message: "I'm having trouble connecting to the AI model. Please make sure Ollama is running (`ollama serve`) and try again.",
        type: 'general',
        actions: []
      }),
      toolCall: null
    };
  }
}

/**
 * Call Claude API with native tool support
 */
async function callClaude(messages, tools = []) {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Separate system prompt from conversation messages
    const systemMsg = messages.find(m => m.role === 'system');
    const conversationMsgs = messages
      .filter(m => m.role !== 'system')
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

    // Define tools for Claude
    const claudeTools = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: tool.parameters,
        required: tool.required || []
      }
    }));

    const requestParams = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1200,
      messages: conversationMsgs,
      ...(systemMsg && { system: systemMsg.content }),
      ...(claudeTools.length > 0 && { tools: claudeTools }),
    };

    const response = await anthropic.messages.create(requestParams);
    const content = response.content[0];

    if (content.type === 'tool_use') {
      return {
        reply: '',
        toolCall: { name: content.name, args: content.input }
      };
    }

    return { reply: content.text || '', toolCall: null };

  } catch (error) {
    console.error('Claude API error:', error.message);
    throw error;
  }
}

/**
 * Main chat function — provider-agnostic
 */
async function chat(messages, tools = []) {
  if (provider === 'claude') return await callClaude(messages, tools);
  if (provider === 'groq') return await callGroq(messages, tools);
  return await callOllama(messages, tools);
}

function getProvider() {
  return provider;
}
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
        message: "Groq API unavailable. Check your GROQ_API_KEY.",
        type: 'general',
        actions: ['Passenger Rights', 'Alternative Flights', 'Airport Services']
      }),
      toolCall: null
    };
  }
}
module.exports = { chat, getProvider };
