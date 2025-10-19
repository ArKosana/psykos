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
                'caption-this': `Generate a funny, interesting image description that people can write captions for. Make it visual and humorous. Return ONLY the description, no category names.`,
                'acronyms': `Generate a well-known acronym (like NASA, FBI, etc.) and its real expansion. Format: "ACRONYM - Real Expansion". Return ONLY the acronym and expansion, no explanations.`,
                'is-that-a-fact': `Generate a surprising but true fact. The fact should be about a single topic/word. Return ONLY the fact, no category names.`,
                'truth-comes-out': `Generate a personal question about specific players. Use player names like "What is ${playerNames[0]}'s shoe size?" or "What did ${playerNames[1]} eat for breakfast?". Available players: ${playerNames.join(', ')}. Return ONLY the question.`,
                'search-history': `Generate the beginning of a funny search query that people would complete (like "why do cats..." or "how to impress..."). Return ONLY the query beginning.`,
                'ice-breaker': `Generate a fun get-to-know-you question. Can be general or specific to players. Available players: ${playerNames.join(', ')}. Return ONLY the question.`,
                'naked-truth': `Generate an adult-themed (18+) personal question for specific players. Use player names. Available players: ${playerNames.join(', ')}. Return ONLY the question.`,
                'who-among-us': `Generate a "who among us" question like "Who among us is most likely to..." or "Who among us would...". Available players: ${playerNames.join(', ')}. Return ONLY the question.`
            };

            const systemPrompt = `You are a party game content generator. Generate engaging, fun content. Keep responses concise. For personal questions, use player names. NEVER include category names, descriptions, or any metadata in your response. Only return the pure content.`;
            
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
                    max_tokens: 100
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

            const response = await fetch(this.baseURL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        { 
                            role: 'system', 
                            content: 'You are a scoring assistant. Evaluate answers based on accuracy and relevance to the correct answer. Return ONLY comma-separated numbers.' 
                        },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 50
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const scoresText = data.choices[0].message.content.trim();
            const scores = scoresText.split(',').map(score => {
                const num = parseInt(score.trim());
                return isNaN(num) ? 5 : Math.min(10, Math.max(1, num));
            });

            return scores;
        } catch (error) {
            console.error('AI Scoring Error:', error);
            return this.getFallbackScores(answers.length);
        }
    }

    getFallbackContent(category, playerNames = []) {
        const randomPlayer = playerNames[Math.floor(Math.random() * playerNames.length)] || 'Player';
        const fallbacks = {
            'caption-this': 'A cat wearing sunglasses and a tiny hat, sitting at a computer keyboard looking very professional.',
            'acronyms': 'NASA - National Aeronautics and Space Administration',
            'is-that-a-fact': 'Octopuses have three hearts and blue blood.',
            'truth-comes-out': `What is ${randomPlayer}'s shoe size?`,
            'search-history': 'how to explain to your boss that...',
            'ice-breaker': `What would you name ${randomPlayer} if you were their parent?`,
            'naked-truth': `What is ${randomPlayer}'s guilty pleasure?`,
            'who-among-us': `Who among us is most likely to become a millionaire?`
        };
        return fallbacks[category] || 'Create something fun and creative!';
    }

    getFallbackScores(count) {
        return Array(count).fill(5); // Return array of 5s as fallback
    }

    async generateQuestion(category, playerNames = []) {
        return this.generateContent('Generate a question or prompt for this game category.', category, playerNames);
    }

    async generateFact() {
        return this.generateContent('Generate a surprising but true fact.', 'is-that-a-fact');
    }
}

export default new AIService();
