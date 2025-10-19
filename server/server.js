import express from 'express';
import AIService from './ai/ai-service.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { WORD_LIST } from './wordlist.js';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = createServer(app);

// CORS setup for production
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? ["https://psykos.vercel.app", "https://psykos-game.vercel.app"] 
            : ["http://localhost:5173", "http://localhost:5174"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ["https://psykos.vercel.app", "https://psykos-game.vercel.app"] 
        : ["http://localhost:5173", "http://localhost:5174"],
    credentials: true
}));

app.use(express.json());

// In-memory storage
const games = new Map();
const players = new Map();
const connectedSockets = new Map();
const usedWords = new Set();

// Utility functions
function generateGameCode() {
    // Get available words (not used in current games)
    const availableWords = WORD_LIST.filter(word => !usedWords.has(word));
    
    if (availableWords.length === 0) {
        // If all words are used, fall back to random code
        return Math.random().toString(36).substring(2, 6).toUpperCase();
    }
    
    const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    usedWords.add(randomWord);
    return randomWord;
}

function cleanupGameCode(gameCode) {
    usedWords.delete(gameCode);
}

function getGame(gameCode) {
    return games.get(gameCode);
}

function createGame(hostId, category, rounds = 10) {
    const gameCode = generateGameCode();
    const game = {
        code: gameCode,
        host: hostId,
        category: category,
        rounds: parseInt(rounds),
        currentRound: 0,
        players: new Map(),
        state: 'lobby',
        questions: [],
        answers: new Map(),
        votes: new Map(),
        scores: new Map(),
        readyPlayers: new Set(),
        usedQuestions: new Set(),
        skipVotes: new Set(),
        gameInProgress: false
    };
    games.set(gameCode, game);
    return game;
}

function formatQuestion(question, category) {
    // Remove category names and descriptions from questions
    const cleanQuestion = question
        .replace(/^[^:]+:\s*/, '') // Remove "Category Name: "
        .replace(/\([^)]*\)/g, '') // Remove parentheses content
        .replace(/\[[^\]]*\]/g, '') // Remove bracket content
        .trim();
    
    return cleanQuestion;
}

// Health check route
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.post('/create-game', (req, res) => {
    const { playerName, category, rounds } = req.body;
    const playerId = uuidv4();
    
    const game = createGame(playerId, category, rounds);
    const player = {
        id: playerId,
        name: playerName,
        gameCode: game.code,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(playerName)}&background=333&color=fff`,
        score: 0,
        isHost: true
    };
    
    game.players.set(playerId, player);
    players.set(playerId, player);
    
    console.log('Game created:', game.code, 'Host:', playerName);
    
    res.json({ 
        gameCode: game.code, 
        playerId: playerId,
        category: game.category
    });
});

app.post('/join-game', (req, res) => {
    const { gameCode, playerName } = req.body;
    const game = getGame(gameCode);
    
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }
    
    const playerId = uuidv4();
    const player = {
        id: playerId,
        name: playerName,
        gameCode: gameCode,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(playerName)}&background=666&color=fff`,
        score: 0,
        isHost: false
    };
    
    game.players.set(playerId, player);
    players.set(playerId, player);
    
    console.log('Player joined:', playerName, 'Game:', gameCode);
    
    // Notify all players in the game
    io.to(gameCode).emit('players-updated', Array.from(game.players.values()));
    
    res.json({ 
        playerId: playerId,
        category: game.category,
        rounds: game.rounds,
        gameInProgress: game.gameInProgress
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-game', ({ gameCode, playerId }) => {
        const game = getGame(gameCode);
        const player = players.get(playerId);
        
        if (game && player) {
            // Remove from previous rooms to prevent duplicate joins
            const previousRooms = Array.from(socket.rooms);
            previousRooms.forEach(room => {
                if (room !== socket.id && room !== gameCode) {
                    socket.leave(room);
                }
            });
            
            // Only join if not already in the room
            if (!socket.rooms.has(gameCode)) {
                socket.join(gameCode);
            }
            
            socket.gameCode = gameCode;
            socket.playerId = playerId;
            
            // Track this socket - replace if already exists
            connectedSockets.set(playerId, socket.id);
            
            console.log('Player joined room:', player.name, 'Game:', gameCode);
            
            // Send current game state to the joining player
            socket.emit('game-state', {
                code: game.code,
                category: game.category,
                players: Array.from(game.players.values()),
                state: game.state,
                currentRound: game.currentRound,
                scores: Array.from(game.scores.entries()),
                gameInProgress: game.gameInProgress
            });

            // Update answer count for all players if game is in progress
            if (game.state === 'playing') {
                io.to(gameCode).emit('answer-count-update', {
                    submitted: game.answers.size,
                    total: game.players.size
                });
            }

            // Update skip votes count
            io.to(gameCode).emit('skip-votes-update', {
                skipVotes: game.skipVotes.size,
                totalPlayers: game.players.size
            });
        }
    });

    socket.on('start-game', async (gameCode) => {
        const game = getGame(gameCode);
        if (game && game.host === socket.playerId && game.players.size >= 2) {
            game.state = 'playing';
            game.currentRound = 1;
            game.gameInProgress = true;
            
            // Generate questions for all rounds
            const playerNames = Array.from(game.players.values()).map(p => p.name);
            game.questions = [];
            
            for (let i = 0; i < game.rounds; i++) {
                let question;
                let attempts = 0;
                
                do {
                    question = await AIService.generateQuestion(game.category, playerNames);
                    attempts++;
                } while (game.usedQuestions.has(question) && attempts < 3);
                
                const formattedQuestion = formatQuestion(question, game.category);
                game.questions.push(formattedQuestion);
                game.usedQuestions.add(question);
            }
            
            io.to(gameCode).emit('game-started', {
                round: 1,
                totalRounds: game.rounds,
                question: game.questions[0]
            });
        }
    });

    socket.on('submit-answer', (gameCode, answer) => {
        const game = getGame(gameCode);
        if (game) {
            game.answers.set(socket.playerId, answer);
            
            // Send updated answer count to all players
            io.to(gameCode).emit('answer-count-update', {
                submitted: game.answers.size,
                total: game.players.size
            });
            
            // Check if all players have answered
            if (game.answers.size === game.players.size) {
                startVotingPhase(game);
            }
        }
    });

    socket.on('submit-vote', (gameCode, votedPlayerId) => {
        const game = getGame(gameCode);
        if (game && game.state === 'voting') {
            // Players cannot vote for themselves
            if (socket.playerId === votedPlayerId) {
                socket.emit('vote-error', 'You cannot vote for yourself');
                return;
            }
            
            game.votes.set(socket.playerId, votedPlayerId);
            
            // Update scores based on category
            updateScores(game, socket.playerId, votedPlayerId);
            
            // Check if all players have voted
            if (game.votes.size === game.players.size) {
                showResults(game);
            }
        }
    });

    socket.on('skip-question', (gameCode) => {
        const game = getGame(gameCode);
        if (game && game.state === 'playing') {
            game.skipVotes.add(socket.playerId);
            
            // Update skip votes count for all players
            io.to(gameCode).emit('skip-votes-update', {
                skipVotes: game.skipVotes.size,
                totalPlayers: game.players.size
            });
            
            // Check if majority wants to skip
            const majority = Math.ceil(game.players.size / 2);
            if (game.skipVotes.size >= majority) {
                skipToNextRound(game);
            }
        }
    });

    socket.on('player-ready', (gameCode) => {
        const game = getGame(gameCode);
        if (game) {
            game.readyPlayers.add(socket.playerId);
            
            // Notify all players about ready status
            io.to(gameCode).emit('player-ready-update', {
                playerId: socket.playerId,
                readyPlayers: Array.from(game.readyPlayers),
                totalPlayers: game.players.size
            });
            
            if (game.readyPlayers.size === game.players.size) {
                startNextRound(game);
            }
        }
    });

    // Voice chat functionality
    socket.on('voice-start', () => {
        const gameCode = socket.gameCode;
        if (gameCode) {
            socket.to(gameCode).emit('voice-start', socket.playerId);
        }
    });

    socket.on('voice-data', (data) => {
        const gameCode = socket.gameCode;
        if (gameCode) {
            socket.to(gameCode).emit('voice-data', {
                playerId: socket.playerId,
                data: data
            });
        }
    });

    socket.on('voice-end', () => {
        const gameCode = socket.gameCode;
        if (gameCode) {
            socket.to(gameCode).emit('voice-end', socket.playerId);
        }
    });

    socket.on('disconnect', () => {
        const playerId = socket.playerId;
        const player = players.get(playerId);
        
        if (player) {
            const game = getGame(player.gameCode);
            if (game) {
                const playerName = player.name;
                game.players.delete(playerId);
                players.delete(playerId);
                connectedSockets.delete(playerId);
                
                // Remove from skip votes and ready players
                game.skipVotes.delete(playerId);
                game.readyPlayers.delete(playerId);
                
                // Notify all players that someone left
                io.to(game.code).emit('player-left', {
                    playerId: playerId,
                    playerName: playerName,
                    remainingPlayers: game.players.size
                });
                
                if (game.players.size === 0) {
                    // No players left, delete game
                    cleanupGameCode(game.code);
                    games.delete(game.code);
                    console.log('Game deleted:', game.code);
                } else if (game.players.size < 2 && game.state !== 'lobby') {
                    // Less than 2 players, return to lobby
                    game.state = 'lobby';
                    game.currentRound = 0;
                    game.answers.clear();
                    game.votes.clear();
                    game.readyPlayers.clear();
                    game.skipVotes.clear();
                    
                    io.to(game.code).emit('return-to-lobby', {
                        reason: 'Not enough players to continue'
                    });
                    console.log('Game returned to lobby:', game.code, 'Reason: Not enough players');
                } else if (game.host === playerId) {
                    // Transfer host to another player
                    const newHost = game.players.values().next().value;
                    game.host = newHost.id;
                    newHost.isHost = true;
                    io.to(game.code).emit('host-changed', newHost.id);
                }
                
                // Update players list
                io.to(game.code).emit('players-updated', Array.from(game.players.values()));
                
                // Update skip votes count
                io.to(game.code).emit('skip-votes-update', {
                    skipVotes: game.skipVotes.size,
                    totalPlayers: game.players.size
                });
            }
        }
        console.log('User disconnected:', socket.id);
    });

    function startVotingPhase(game) {
        const answersArray = Array.from(game.answers.entries()).map(([playerId, answer]) => ({
            playerId,
            answer,
            playerName: game.players.get(playerId)?.name || 'Unknown'
        }));
        
        const shuffledAnswers = answersArray.sort(() => Math.random() - 0.5);
        game.state = 'voting';
        
        io.to(game.code).emit('start-voting', {
            answers: shuffledAnswers,
            question: game.questions[game.currentRound - 1],
            category: game.category
        });
    }

    function updateScores(game, voterId, votedPlayerId) {
        // Different scoring based on category
        switch (game.category) {
            case 'acronyms':
            case 'is-that-a-fact':
                // 10 points for correct answer, 20 points for tricking others
                // This would need additional logic to track correct answers
                if (!game.scores.has(votedPlayerId)) {
                    game.scores.set(votedPlayerId, 0);
                }
                game.scores.set(votedPlayerId, game.scores.get(votedPlayerId) + 10);
                break;
                
            case 'truth-comes-out':
            case 'naked-truth':
                // AI-based scoring handled separately
                if (!game.scores.has(votedPlayerId)) {
                    game.scores.set(votedPlayerId, 0);
                }
                game.scores.set(votedPlayerId, game.scores.get(votedPlayerId) + 10);
                break;
                
            default:
                // Default scoring: 10 points per vote
                if (!game.scores.has(votedPlayerId)) {
                    game.scores.set(votedPlayerId, 0);
                }
                game.scores.set(votedPlayerId, game.scores.get(votedPlayerId) + 10);
        }
    }

    function showResults(game) {
        const results = {
            question: game.questions[game.currentRound - 1],
            answers: Array.from(game.answers.entries()),
            votes: Array.from(game.votes.entries()),
            scores: Array.from(game.scores.entries()),
            players: Array.from(game.players.values()),
            category: game.category
        };
        
        io.to(game.code).emit('show-results', results);
        
        // Reset for next round
        game.answers.clear();
        game.votes.clear();
        game.skipVotes.clear();
        game.state = 'results';
    }

    function skipToNextRound(game) {
        game.currentRound++;
        if (game.currentRound > game.rounds) {
            endGame(game);
        } else {
            io.to(game.code).emit('next-round', {
                round: game.currentRound,
                question: game.questions[game.currentRound - 1],
                skipped: true
            });
            game.answers.clear();
            game.skipVotes.clear();
        }
    }

    function startNextRound(game) {
        game.currentRound++;
        if (game.currentRound > game.rounds) {
            endGame(game);
        } else {
            io.to(game.code).emit('next-round', {
                round: game.currentRound,
                question: game.questions[game.currentRound - 1]
            });
            game.readyPlayers.clear();
            game.skipVotes.clear();
            game.state = 'playing';
        }
    }

    function endGame(game) {
        const finalScores = Array.from(game.scores.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([playerId, score]) => {
                const player = game.players.get(playerId);
                return {
                    playerId,
                    name: player.name,
                    score: score
                };
            });
        
        io.to(game.code).emit('game-over', {
            scores: finalScores,
            winner: finalScores[0]
        });
        
        cleanupGameCode(game.code);
        games.delete(game.code);
    }
});

const PORT = process.env.PORT || 5174;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
