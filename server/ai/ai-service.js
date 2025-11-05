import fetch from 'node-fetch';

class AIService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.baseURL = 'https://api.groq.com/openai/v1/chat/completions';
  }

  async chat(messages, temperature = 0.8, max_tokens = 120) {
    if (!this.apiKey) return null;

    const res = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature,
        max_tokens
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  }

  // Generic content generator (kept for default categories)
  async generateContent(prompt, category, playerNames = []) {
    try {
      if (!this.apiKey) return this.getFallbackContent(category, playerNames);

      const categoryPrompts = {
        'caption-this': `Generate a funny, visual image description for a caption game. Return ONLY the description.`,
        'search-history': `Generate the beginning of a funny search query people would complete (e.g., "why do cats...", "how to impress..."). Return ONLY the query beginning.`,
        'ice-breaker': `Generate a short, fun get-to-know-you question. You may reference players: ${playerNames.join(', ')}. Return ONLY the question.`,
        'who-among-us': `Generate a short "Who among us is most likely to..." style prompt. Return ONLY the question.`,
        'truth-comes-out': `Generate a short personal question about a specific player (use one of: ${playerNames.join(', ')}). Return ONLY the question.`,
        'naked-truth': `Generate a short 18+ personal question about a specific player (use one of: ${playerNames.join(', ')}). Return ONLY the question.`
      };

      const systemPrompt = `You are a party game content generator. Never include category names or metadata.`
      const userPrompt = `${categoryPrompts[category] || prompt}`

      const text = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      return text || this.getFallbackContent(category, playerNames);
    } catch (e) {
      return this.getFallbackContent(category, playerNames);
    }
  }

  // ACRONYMS → { acronym, expansion }
  async generateAcronymPair() {
    if (!this.apiKey) {
      return { acronym: 'NASA', expansion: 'National Aeronautics and Space Administration' }
    }
    const system = `Return ONLY valid JSON like {"acronym":"NASA","expansion":"National Aeronautics and Space Administration"}`
    const user = `Provide a well-known acronym and its correct expansion.`
    const text = await this.chat([
      { role: 'system', content: system },
      { role: 'user', content: user }
    ], 0.6, 60)

    try {
      const j = JSON.parse(text)
      if (j?.acronym && j?.expansion) return j
    } catch {}
    // Fallback parse "NASA - National ..."
    if (text && text.includes('-')) {
      const [acronym, expansion] = text.split('-')
      return { acronym: acronym.trim(), expansion: (expansion||'').trim() }
    }
    return { acronym: 'NASA', expansion: 'National Aeronautics and Space Administration' }
  }

  // IS-THAT-A-FACT → input word + true fact
  async generateTrueFactForWord(word) {
    if (!this.apiKey) {
      return `Pigs are highly intelligent animals and can learn complex tasks.`
    }
    const system = `Return ONLY a single true sentence about the provided word.`
    const user = `Provide a short true fact about "${word}".`
    const fact = await this.chat([
      { role: 'system', content: system },
      { role: 'user', content: user }
    ], 0.5, 60)
    return fact || `Pigs are highly intelligent animals and can learn complex tasks.`
  }

  async evaluateAnswers(question, answers, correctAnswer) {
    try {
      if (!this.apiKey) {
        return this.getFallbackScores(answers.length);
      }

      const prompt = `
Question: "${question}"
Correct Answer: "${correctAnswer}"

Evaluate these answers on how close they are to the correct answer on a scale of 1-10:
${answers.map((answer, index) => `${index + 1}. "${answer}"`).join('\n')}

Return ONLY a comma-separated list of scores in the same order. Example: "7,5,9,3"
      `.trim();

      const text = await this.chat([
        { role: 'system', content: 'You are a scoring assistant. Return ONLY comma-separated numbers.' },
        { role: 'user', content: prompt }
      ], 0.3, 60)

      if (!text) return this.getFallbackScores(answers.length);
      const scores = text.split(',').map(s => {
        const n = parseInt(s.trim(), 10)
        return (isNaN(n) ? 5 : Math.min(10, Math.max(1, n)))
      })
      return scores
    } catch {
      return this.getFallbackScores(answers.length);
    }
  }

  getFallbackContent(category, playerNames = []) {
    const randomPlayer = playerNames[Math.floor(Math.random() * playerNames.length)] || 'Player';
    const fallbacks = {
      'caption-this': 'A cat wearing sunglasses and a tiny hat, sitting at a computer keyboard looking very professional.',
      'search-history': 'how to explain to your boss that...',
      'ice-breaker': `What would you name ${randomPlayer} if you were their parent?`,
      'who-among-us': `Who among us is most likely to become a millionaire?`,
      'truth-comes-out': `What is ${randomPlayer}'s shoe size?`,
      'naked-truth': `What is ${randomPlayer}'s guilty pleasure?`
    };
    return fallbacks[category] || 'Create something fun and creative!';
  }

  getFallbackScores(count) { return Array(count).fill(5) }

  async generateQuestion(category, playerNames = []) {
    // Default generator for categories that don't need structure
    return this.generateContent('Generate a question or prompt for this game category.', category, playerNames);
  }
}

export default new AIService();
