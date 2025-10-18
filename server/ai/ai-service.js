import fetch from 'node-fetch';

class AIService {
    constructor() {
        this.apiKey = process.env.GROQ_API_KEY;
        this.baseURL = 'https://api.groq.com/openai/v1/chat/completions';
    }

    async generateContent(prompt, category, playerNames = []) {
        try {
            if (!this.apiKey) {
                return this.getFallbackContent(category, playerNames);
            }

            const categoryPrompts = {
                'caption-this': `Generate a funny, interesting image description that people can write captions for. Make it visual and humorous.`,
                'acronyms': `Generate a common acronym (like NASA, FBI, LOL) that people might not know the real meaning of. Provide the acronym and its real meaning.`,
                'is-that-a-fact': `Generate a surprising but true fact about an interesting topic (science, history, animals, etc.). Make it believable but surprising.`,
                'truth-comes-out': `Generate a personal question about specific players. Use player names like "What is ${playerNames[0]}'s guilty pleasure?" instead of "your guilty pleasure". Make it fun and revealing. Available players: ${playerNames.join(', ')}.`,
                'search-history': `Generate the beginning of a funny search query that people would complete (like "why do cats..." or "how to impress...").`,
                'ice-breaker': `Generate a fun get-to-know-you question for a group of people.`,
                'naked-truth': `Generate an adult-themed (18+) personal question for specific players. Use player names like "What is ${playerNames[0]}'s wildest fantasy?" instead of "your wildest fantasy". Keep it fun but mature. Available players: ${playerNames.join(', ')}.`
            };

            const systemPrompt = `You are a party game content generator. Generate engaging, fun content for a social deduction game similar to Psych!. Keep responses concise and entertaining. For personal questions, always use player names instead of "you" or "your".`;
            
            const userPrompt = `${categoryPrompts[category]}\n\n${prompt || 'Generate content for this category:'}`;

            const response = await fetch(this.baseURL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.8,
                    max_tokens: 150
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error('AI Service Error:', error);
            return this.getFallbackContent(category, playerNames);
        }
    }

    getFallbackContent(category, playerNames = []) {
        const randomPlayer = playerNames[Math.floor(Math.random() * playerNames.length)] || 'Player';
        const fallbacks = {
            'caption-this': 'A cat wearing sunglasses and a tiny hat, sitting at a computer keyboard looking very professional.',
            'acronyms': 'NASA - National Aeronautics and Space Administration',
            'is-that-a-fact': 'Octopuses have three hearts and blue blood.',
            'truth-comes-out': `What is ${randomPlayer}'s most embarrassing childhood memory?`,
            'search-history': 'how to explain to your boss that...',
            'ice-breaker': 'If you could have any superpower, what would it be and why?',
            'naked-truth': `What is ${randomPlayer}'s guilty pleasure that they would never admit in public?`
        };
        return fallbacks[category] || 'Create something fun and creative!';
    }

    async generateQuestion(category, playerNames = []) {
        return this.generateContent('Generate a question or prompt for this game category.', category, playerNames);
    }

    async generateFact() {
        return this.generateContent('Generate a surprising but true fact.', 'is-that-a-fact');
    }
}

export default new AIService();
