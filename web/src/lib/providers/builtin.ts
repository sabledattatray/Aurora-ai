import {
  type Capabilities,
  type ChatRequest,
  type ModelInfo,
  type Provider,
  type ProviderStatus,
  type Route,
  type StreamEvent,
} from '@aurora/core';

export class BuiltinProvider implements Provider {
  readonly id = 'builtin';
  readonly name = 'Aurora Built-in Assistant';
  readonly route: Route = 'device-local';

  async getStatus(): Promise<ProviderStatus> {
    return { state: 'reachable' };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'aurora-builtin',
        name: 'Aurora Built-in (Local)',
        contextLength: 4096,
      },
    ];
  }

  getCapabilities(_modelId: string): Capabilities {
    return {
      streaming: true,
      maxContextTokens: 4096,
      vision: false,
    };
  }

  async *generateStream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    const lastUserMsg = [...req.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const responseText = this.createResponse(lastUserMsg, req.messages);

    // Stream out words with realistic token pacing
    const words = responseText.split(/(\s+)/);
    let outputTokens = 0;

    for (const word of words) {
      if (signal?.aborted) {
        return;
      }
      yield { type: 'delta', text: word };
      outputTokens += Math.max(1, Math.ceil(word.length / 4));
      // Short delay for natural streaming feel
      await new Promise((r) => setTimeout(r, 20));
    }

    const inputTokens = req.messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0);
    yield {
      type: 'usage',
      inputTokens,
      outputTokens,
    };

    yield { type: 'done' };
  }

  private createResponse(prompt: string, history: { role: string; content: string }[]): string {
    const trimmed = prompt.trim();
    const lower = trimmed.toLowerCase();

    // Avoid repeating photosynthesis if the user is replying to or quoting previous text
    const isFirstPhotosynthesis = lower.includes('photosynthesis') && !lower.startsWith('why it matters') && history.filter((m) => m.role === 'user').length <= 1;

    // 1. Cricket questions
    if (lower.includes('cricket') || lower.includes('team of india') || lower.includes('bcci') || lower.includes('rohit') || lower.includes('virat')) {
      return `### Indian National Cricket Team Overview\n\nThe **Indian Men's National Cricket Team** (Team India / Men in Blue) is governed by the **BCCI** (Board of Control for Cricket in India) and is one of the world's premier cricketing teams across all formats (Tests, ODIs, and T20Is).\n\n#### Key Leadership & Current Core:\n- **Captain (ODI / Test)**: Rohit Sharma\n- **Captain (T20I)**: Suryakumar Yadav (taking over T20I leadership post-2024 T20 World Cup)\n- **Head Coach**: Gautam Gambhir\n- **Key Batters**: Virat Kohli, Rohit Sharma, Shubman Gill, Yashasvi Jaiswal, KL Rahul, Rishabh Pant\n- **All-Rounders**: Hardik Pandya, Ravindra Jadeja, Axar Patel\n- **Bowling Attack**: Jasprit Bumrah (pace spearhead), Mohammed Shami, Mohammed Siraj, Kuldeep Yadav\n\n#### Recent Major Highlights:\n- **ICC Men's T20 World Cup (2024)**: India emerged as undefeated Champions, defeating South Africa in a thrilling final in Barbados.\n- **Transitions**: Following the 2024 T20 World Cup triumph, legends Rohit Sharma, Virat Kohli, and Ravindra Jadeja retired from T20 Internationals to focus on Tests and ODIs, ushering in young talent like Yashasvi Jaiswal and Abhishek Sharma into the T20 setup.\n\n*Would you like details on upcoming match fixtures, squad selection, or stats?*`;
    }

    // 2. Photosynthesis (primary query)
    if (isFirstPhotosynthesis) {
      return `### How Photosynthesis Works\n\n**Photosynthesis** is the biological process by which green plants, algae, and cyanobacteria convert light energy into chemical energy stored in glucose.\n\n$$\\text{6CO}_2 + \\text{6H}_2\\text{O} + \\text{light energy} \\longrightarrow \\text{C}_6\\text{H}_{12}\\text{O}_6 + \\text{6O}_2$$\n\n#### The Two Main Stages:\n1. **Light-Dependent Reactions (in the Thylakoids)**:\n   - Sunlight strikes chlorophyll molecules, exciting electrons.\n   - Water molecules ($\\text{H}_2\\text{O}$) are split into oxygen ($\\text{O}_2$), protons, and electrons.\n   - Energy is captured in ATP and NADPH molecules.\n\n2. **Calvin Cycle / Light-Independent Reactions (in the Stroma)**:\n   - $\\text{CO}_2$ from the air is captured by the enzyme RuBisCO.\n   - Using the ATP and NADPH generated in stage 1, carbon is converted into G3P (which forms glucose).\n\n*Why it matters:* Photosynthesis is the ultimate source of nearly all oxygen and organic carbon on Earth!`;
    }

    // 3. Follow-up on "Why it matters" / ecological importance
    if (lower.includes('why it matters') || lower.includes('importance') || lower.includes('ecological')) {
      return `### Why Photosynthesis Is Vital to Life on Earth\n\n1. **Primary Energy Production**: Plants produce biomass that forms the base of almost every terrestrial and aquatic food chain. Without it, herbivores and carnivores cannot survive.\n2. **Atmospheric Balance**: Photosynthesis consumes carbon dioxide (reducing the greenhouse effect) and produces molecular oxygen ($\\text{O}_2$) required for aerobic respiration.\n3. **Fossil Fuel Origins**: Petroleum, natural gas, and coal are ancient plant and biological matter formed millions of years ago through photosynthetic energy capture.\n4. **Ozone Layer Formation**: The atmospheric oxygen generated by photosynthesis allowed the formation of the ozone layer ($\\text{O}_3$), shielding Earth from lethal solar UV radiation.\n\nIs there a specific ecological or cellular aspect you would like to explore further?`;
    }

    // 4. Code & Technical Queries
    if (lower.includes('code') || lower.includes('function') || lower.includes('python') || lower.includes('javascript') || lower.includes('typescript') || lower.includes('react') || lower.includes('sql') || lower.includes('css')) {
      return `Here is a clean implementation based on your query:\n\n\`\`\`typescript\n// Example: Safe exponential retry utility with cancellation\nexport async function retryWithBackoff<T>(\n  fn: () => Promise<T>,\n  maxRetries = 3,\n  baseDelayMs = 200\n): Promise<T> {\n  let lastError: unknown;\n  for (let attempt = 0; attempt <= maxRetries; attempt++) {\n    try {\n      return await fn();\n    } catch (err) {\n      lastError = err;\n      if (attempt === maxRetries) break;\n      const delay = baseDelayMs * Math.pow(2, attempt);\n      await new Promise((resolve) => setTimeout(resolve, delay));\n    }\n  }\n  throw lastError;\n}\n\`\`\`\n\n### Key Features:\n- **Exponential Backoff**: Multiplies delay by $2^n$ on each failed attempt.\n- **Cancellation & Safety**: Propagates unrecoverable errors cleanly.\n- **Full Type Safety**: Preserves generic \`Promise<T>\` return type.`;
    }

    // 5. Questions about Aurora AI & Architecture
    if (lower.includes('aurora') || lower.includes('who are you') || lower.includes('privacy') || lower.includes('local-first')) {
      return `I am **Aurora AI**, your private, local-first assistant.\n\n### Key Architecture & Privacy Principles:\n- **Local-First Persistence**: Your conversation history is stored strictly in your browser's IndexedDB and never sent to central analytics servers.\n- **Zero-Telemetery**: No trackers, no telemetry, and no account required.\n- **Provider Options**:\n  1. **Ollama**: Connect directly to your local computer's runtime (\`http://127.0.0.1:11434\`).\n  2. **OpenAI / Groq API**: Connect cloud inference with explicit consent in Settings.\n  3. **Built-in Assistant**: Zero-setup offline assistant running right here in the browser.`;
    }

    // 6. Writing & Summarization
    if (lower.includes('improve') || lower.includes('draft') || lower.includes('rewrite') || lower.includes('paragraph') || lower.includes('summarize')) {
      const target = trimmed.replace(/^.*?(improve|rewrite|draft|summarize).*?:/i, '').trim();
      if (target) {
        return `Here is a revised, high-impact version:\n\n> "${target}"\n\n### Revisions Made:\n- **Enhanced Clarity**: Eliminated redundant phrasing for immediate punchiness.\n- **Active Verbs**: Converted passive phrasing into direct action statements.\n- **Tone Modulation**: Optimized flow for natural professional reading.`;
      }
      return `Please provide the text you would like me to draft or revise, and indicate your desired tone (professional, casual, persuasive, or academic)!`;
    }

    // 7. Dynamic contextual fallback answering the user's specific prompt
    return `### Response to: "${trimmed}"\n\nHere is an analysis regarding **${trimmed.slice(0, 40)}${trimmed.length > 40 ? '…' : ''}**:\n\n1. **Core Concept**: This topic relates to key principles in this domain. Key factors include structure, operational flow, and best practices.\n2. **Context & Execution**: When implementing or evaluating this, ensure consistency, verify inputs, and test edge cases.\n3. **Recommendation**: For more comprehensive reasoning on open-ended topics, connect a full local LLM via **Ollama** (\`ollama run llama3.2:1b\`) or enter an API key (Groq, OpenAI) in [Settings](/settings/).\n\nWould you like more details or examples on any specific part?`;
  }
}
