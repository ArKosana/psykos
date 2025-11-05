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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = createServer(app);

const PROD_ORIGINS = ["https://psykos.vercel.app", "https://psykos-game.vercel.app"];
const DEV_ORIGINS = ["http://localhost:5173", "http://localhost:5174"];

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? PROD_ORIGINS : DEV_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? PROD_ORIGINS : DEV_ORIGINS,
  credentials: true
}));
app.use(express.json());

// In-memory storage
const games = new Map();
const players = new Map();
const connectedSockets = new Map();
const usedWords = new Set();

function generateGameCode() {
  const availableWords = WORD_LIST.filter(w => !usedWords.has(w));
  if (availableWords.length === 0) {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  }
  const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
  usedWords.add(randomWord);
  return randomWord;
}
function cleanupGameCode(code) { usedWords.delete(code); }
function getGame(code) { return games.get(code); }

function createGame(hostId, category, rounds = 10) {
  const code = generateGameCode();
  const game = {
    code,
    host: hostId,
    category,
    rounds: parseInt(rounds, 10),
    currentRound: 0,
    players: new Map(),
    state: 'lobby',
    questions: [],               // [{ prompt, meta }]
    answers: new Map(),          // playerId -> answer string
    votes: new Map(),            // voterId -> votedPlayerId or 'CORRECT'
    scores: new Map(),           // playerId -> totalScore
    readyPlayers: new Set(),
    usedQuestions: new Set(),
    skipVotes: new Set(),
    gameInProgress: false,
    roundDeltas: new Map(),      // playerId -> points gained this round
    roundResults: [],            // [{playerId, playerName, delta, detail}]
    // Who Among Us phase data
    whoPhase: {
      voteMap: new Map(),        // targetId -> Set<voterId>
      topTargetId: null,
      guessSubmissions: new Map()// playerId -> { targetId, guesses: Set<voterId> }
    }
  };
  games.set(code, game);
  return game;
}

function formatQuestion(text) {
  if (!text) return '';
  return text
    .replace(/^[^:]+:\s*/, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .trim();
}

// Seed words for "is-that-a-fact" prompts
const FACT_WORDS = ['pig', 'ocean', 'coffee', 'black', 'honey', 'ant', 'moon', 'snake', 'ice', 'rain', 'gold', 'mango', 'neon', 'whale'];

app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

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
  res.json({ gameCode: game.code, playerId, category: game.category });
});

app.post('/join-game', (req, res) => {
  const { gameCode, playerName } = req.body;
  const game = getGame(gameCode);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const playerId = uuidv4();
  const player = {
    id: playerId, name: playerName, gameCode, 
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(playerName)}&background=666&color=fff`,
    score: 0, isHost: false
  };
  game.players.set(playerId, player);
  players.set(playerId, player);

  io.to(gameCode).emit('players-updated', Array.from(game.players.values()));
  res.json({ playerId, category: game.category, rounds: game.rounds, gameInProgress: game.gameInProgress });
});

io.on('connection', (socket) => {
  socket.on('join-game', ({ gameCode, playerId }) => {
    const game = getGame(gameCode);
    const player = players.get(playerId);
    if (!game || !player) return;

    // Leave other rooms; join this one
    [...socket.rooms].forEach(r => { if (r !== socket.id) socket.leave(r) })
    socket.join(gameCode);
    socket.gameCode = gameCode;
    socket.playerId = playerId;
    connectedSockets.set(playerId, socket.id);

    socket.emit('game-state', {
      code: game.code,
      category: game.category,
      players: Array.from(game.players.values()),
      state: game.state,
      round: game.currentRound,
      totalRounds: game.rounds,
      scores: Array.from(game.scores.entries()),
      gameInProgress: game.gameInProgress
    });

    if (game.state === 'playing') {
      io.to(gameCode).emit('answer-count-update', { submitted: game.answers.size, total: game.players.size });
    }
    io.to(gameCode).emit('skip-votes-update', { skipVotes: game.skipVotes.size, totalPlayers: game.players.size });
  });

  socket.on('start-game', async (gameCode) => {
    const game = getGame(gameCode);
    if (!game) return;
    if (game.host !== socket.playerId) return;
    if (game.players.size < 2) return;

    game.state = 'playing';
    game.currentRound = 1;
    game.gameInProgress = true;

    const playerNames = Array.from(game.players.values()).map(p => p.name);
    game.questions = [];

    for (let i = 0; i < game.rounds; i++) {
      const meta = {};
      let prompt = '';

      if (game.category === 'acronyms') {
        const pair = await AIService.generateAcronymPair();
        meta.type = 'acronyms';
        meta.acronym = (pair.acronym || 'NASA').toUpperCase();
        meta.expansion = pair.expansion || 'National Aeronautics and Space Administration';
        prompt = meta.acronym; // show only the acronym
      } else if (game.category === 'is-that-a-fact') {
        meta.type = 'is-that-a-fact';
        meta.word = FACT_WORDS[Math.floor(Math.random() * FACT_WORDS.length)];
        meta.trueFact = await AIService.generateTrueFactForWord(meta.word);
        prompt = meta.word; // show only the seed word
      } else if (game.category === 'truth-comes-out' || game.category === 'naked-truth') {
        meta.type = game.category;
        const ids = Array.from(game.players.keys());
        meta.targetId = ids[Math.floor(Math.random() * ids.length)];
        const q = await AIService.generateQuestion(game.category, playerNames);
        prompt = formatQuestion(q);
      } else if (game.category === 'who-among-us') {
        meta.type = 'who-among-us';
        // Prompt like "Who among us is most likely to..." (AI handled in generateQuestion)
        prompt = formatQuestion(await AIService.generateQuestion('who-among-us', playerNames));
      } else {
        // default voting categories
        meta.type = game.category;
        prompt = formatQuestion(await AIService.generateQuestion(game.category, playerNames));
      }

      game.questions.push({ prompt, meta });
    }

    io.to(gameCode).emit('game-started', {
      round: 1,
      totalRounds: game.rounds,
      question: game.questions[0].prompt,
      category: game.category
    });
  });

  socket.on('submit-answer', (gameCode, answer) => {
    const game = getGame(gameCode);
    if (!game) return;

    game.answers.set(socket.playerId, String(answer || '').trim());

    // update counts
    io.to(gameCode).emit('answer-count-update', { submitted: game.answers.size, total: game.players.size });

    if (game.answers.size === game.players.size) {
      // All submitted -> advance
      startVotingOrScoringPhase(game);
    }
  });

  socket.on('submit-vote', (gameCode, votedPlayerId) => {
    const game = getGame(gameCode);
    if (!game || game.state !== 'voting') return;

    if (votedPlayerId === socket.playerId) {
      socket.emit('vote-error', 'You cannot vote for yourself');
      return;
    }
    game.votes.set(socket.playerId, votedPlayerId);

    const roundIdx = game.currentRound - 1;
    const q = game.questions[roundIdx];

    // For who-among-us we don't immediately score on phase 1
    if (q.meta.type !== 'who-among-us') {
      applyVoteScore(game, socket.playerId, votedPlayerId);
    }

    // All votes?
    if (game.votes.size === game.players.size) {
      if (q.meta.type === 'who-among-us') {
        startWhoGuessPhase(game);
      } else {
        showResults(game);
      }
    }
  });

  // Who Among Us — phase 2: submit guesses of who voted
  socket.on('who-guess-submit', ({ gameCode, targetId, guesses }) => {
    const game = getGame(gameCode);
    if (!game) return;
    const { whoPhase } = game;
    if (!whoPhase || game.state !== 'who-guess') return;

    // sanitize
    const uniq = Array.from(new Set((guesses || []).filter(id => id && id !== socket.playerId)));

    whoPhase.guessSubmissions.set(socket.playerId, { targetId, guesses: new Set(uniq) });

    if (whoPhase.guessSubmissions.size === game.players.size) {
      // Score phase-2 guesses
      scoreWhoGuessPhase(game);
      showResults(game);
    }
  });

  socket.on('skip-question', (gameCode) => {
    const game = getGame(gameCode);
    if (!game || (game.state !== 'playing' && game.state !== 'voting')) return;
    game.skipVotes.add(socket.playerId);

    io.to(gameCode).emit('skip-votes-update', { skipVotes: game.skipVotes.size, totalPlayers: game.players.size });

    const majority = Math.ceil(game.players.size / 2);
    if (game.skipVotes.size >= majority) {
      // treat as skip -> next round (without scoring)
      skipToNextRound(game);
    }
  });

  socket.on('player-ready', (gameCode) => {
    const game = getGame(gameCode);
    if (!game) return;
    game.readyPlayers.add(socket.playerId);

    io.to(game.code).emit('player-ready-update', {
      playerId: socket.playerId,
      readyPlayers: Array.from(game.readyPlayers),
      totalPlayers: game.players.size
    });

    if (game.readyPlayers.size === game.players.size) {
      startNextRound(game);
    }
  });

  // Voice relays
  socket.on('voice-start', () => { const g = socket.gameCode; if (g) socket.to(g).emit('voice-start', socket.playerId); });
  socket.on('voice-data', (data) => { const g = socket.gameCode; if (g) socket.to(g).emit('voice-data', { playerId: socket.playerId, data }); });
  socket.on('voice-end', () => { const g = socket.gameCode; if (g) socket.to(g).emit('voice-end', socket.playerId); });

  socket.on('disconnect', () => {
    const playerId = socket.playerId;
    const player = players.get(playerId);
    if (!player) return;

    const game = getGame(player.gameCode);
    if (!game) return;

    const name = player.name;
    game.players.delete(playerId);
    players.delete(playerId);
    connectedSockets.delete(playerId);
    game.skipVotes.delete(playerId);
    game.readyPlayers.delete(playerId);

    io.to(game.code).emit('player-left', { playerId, playerName: name, remainingPlayers: game.players.size });

    if (game.players.size === 0) {
      cleanupGameCode(game.code);
      games.delete(game.code);
    } else if (game.players.size < 3 && game.state !== 'lobby') {
      // return to lobby if too few players to continue
      resetRoundState(game);
      game.state = 'lobby';
      game.currentRound = 0;
      game.gameInProgress = false;
      io.to(game.code).emit('return-to-lobby', { reason: 'Not enough players to continue (minimum 3 required)' });
    } else if (game.host === playerId) {
      // transfer host
      const remaining = Array.from(game.players.values());
      if (remaining.length > 0) {
        const newHost = remaining[0];
        game.host = newHost.id;
        newHost.isHost = true;
        io.to(game.code).emit('host-changed', newHost.id);
        io.to(game.code).emit('players-updated', Array.from(game.players.values()));
      }
    }

    io.to(game.code).emit('players-updated', Array.from(game.players.values()));
    io.to(game.code).emit('skip-votes-update', { skipVotes: game.skipVotes.size, totalPlayers: game.players.size });
  });

  // ---- helpers ----

  function initRoundDeltas(game) {
    game.roundDeltas.clear();
    for (const id of game.players.keys()) game.roundDeltas.set(id, 0);
  }

  function addPoints(game, playerId, pts) {
    const cur = game.scores.get(playerId) || 0;
    game.scores.set(playerId, cur + pts);
    game.roundDeltas.set(playerId, (game.roundDeltas.get(playerId) || 0) + pts);
  }

  function resetRoundState(game) {
    game.answers.clear();
    game.votes.clear();
    game.readyPlayers.clear();
    game.skipVotes.clear();
    game.roundResults = [];
    game.whoPhase = { voteMap: new Map(), topTargetId: null, guessSubmissions: new Map() };
    initRoundDeltas(game);
  }

  function startVotingOrScoringPhase(game) {
    const roundIdx = game.currentRound - 1;
    const q = game.questions[roundIdx];

    // TRUTH/Naked: AI scoring directly (no voting)
    if (q.meta.type === 'truth-comes-out' || q.meta.type === 'naked-truth') {
      const targetId = q.meta.targetId;
      const correctAnswer = game.answers.get(targetId) || '';
      const others = [];
      const othersMap = [];

      for (const [pid, ans] of game.answers.entries()) {
        if (pid === targetId) continue;
        others.push(ans);
        othersMap.push(pid);
      }

      (async () => {
        const grades = await AIService.evaluateAnswers(q.prompt, others, correctAnswer);
        grades.forEach((g, i) => addPoints(game, othersMap[i], g));
        game.roundResults = othersMap.map((pid, i) => ({
          playerId: pid,
          playerName: game.players.get(pid)?.name || 'Player',
          delta: grades[i],
          detail: 'Closeness to correct answer'
        }));
        showResults(game);
      })();
      return;
    }

    // Voting categories: build answers list; inject correct option for some categories
    const answersArray = Array.from(game.answers.entries()).map(([playerId, answer]) => ({
      playerId, answer, playerName: game.players.get(playerId)?.name || 'Unknown'
    }));

    if (q.meta.type === 'acronyms') {
      answersArray.push({ playerId: 'CORRECT', answer: q.meta.expansion, playerName: '—' });
    } else if (q.meta.type === 'is-that-a-fact') {
      answersArray.push({ playerId: 'CORRECT', answer: q.meta.trueFact, playerName: '—' });
    }

    const shuffled = answersArray.sort(() => Math.random() - 0.5);
    game.state = 'voting';

    io.to(game.code).emit('start-voting', {
      answers: shuffled,
      question: q.prompt,
      category: game.category
    });
  }

  function applyVoteScore(game, voterId, votedPlayerId) {
    const roundIdx = game.currentRound - 1;
    const q = game.questions[roundIdx];

    if (q.meta.type === 'acronyms' || q.meta.type === 'is-that-a-fact') {
      if (votedPlayerId === 'CORRECT') {
        addPoints(game, voterId, 10);         // correct pick
      } else if (votedPlayerId !== voterId) {
        addPoints(game, votedPlayerId, 20);   // deceiver points
      }
      return;
    }

    if (q.meta.type === 'who-among-us') {
      // Phase 1: just tally votes per target; don't score yet
      const map = game.whoPhase.voteMap;
      if (!map.has(votedPlayerId)) map.set(votedPlayerId, new Set());
      map.get(votedPlayerId).add(voterId);
      return;
    }

    // Default (ice-breaker, search-history, caption-this)
    if (votedPlayerId !== voterId) addPoints(game, votedPlayerId, 10);
  }

  function startWhoGuessPhase(game) {
    const roundIdx = game.currentRound - 1;
    const q = game.questions[roundIdx];
    const map = game.whoPhase.voteMap;

    // Build counts & find top target
    let topTargetId = null;
    let topCount = -1;
    for (const pid of game.players.keys()) {
      const count = (map.get(pid)?.size || 0);
      if (count > topCount) { topCount = count; topTargetId = pid; }
    }
    game.whoPhase.topTargetId = topTargetId;
    game.state = 'who-guess';

    // Broadcast neutral summary (no identities), each client will decide UI
    const summary = [];
    for (const [pid, p] of game.players.entries()) {
      summary.push({
        playerId: pid,
        name: p.name,
        votes: (map.get(pid)?.size || 0)
      });
    }

    io.to(game.code).emit('who-guess-phase', {
      round: game.currentRound,
      totalRounds: game.rounds,
      question: q.prompt,
      summary,             // [{playerId,name,votes}] — identities of voters are hidden
      topTargetId          // players with 0 votes guess voters for this player
    });
  }

  function scoreWhoGuessPhase(game) {
    const { voteMap, topTargetId, guessSubmissions } = game.whoPhase;
    // +10 points per correct guess
    for (const [pid, submission] of guessSubmissions.entries()) {
      const target = submission.targetId || pid; // default to self
      const actualVoters = voteMap.get(target) || new Set();
      let correct = 0;
      for (const g of submission.guesses) {
        if (actualVoters.has(g)) correct++;
      }
      if (correct > 0) addPoints(game, pid, correct * 10);
      // Record round detail
      game.roundResults.push({
        playerId: pid,
        playerName: game.players.get(pid)?.name || 'Player',
        delta: correct * 10,
        detail: `Correctly guessed ${correct} voter(s)`
      });
    }
  }

  function showResults(game) {
    const roundIdx = game.currentRound - 1;
    const q = game.questions[roundIdx];

    const scoresArr = Array.from(game.scores.entries()).map(([playerId, score]) => ({
      playerId, name: game.players.get(playerId)?.name || 'Player', score
    })).sort((a,b) => b.score - a.score);

    if (game.roundResults.length === 0) {
      for (const [pid] of game.players.entries()) {
        const delta = game.roundDeltas.get(pid) || 0;
        game.roundResults.push({
          playerId: pid,
          playerName: game.players.get(pid)?.name || 'Player',
          delta,
          detail: 'Votes / points this round'
        });
      }
    }

    game.state = 'results';

    io.to(game.code).emit('show-results', {
      round: game.currentRound,
      totalRounds: game.rounds,
      question: q.prompt,
      category: game.category,
      answers: Array.from(game.answers.entries()),
      votes: Array.from(game.votes.entries()),
      scores: scoresArr,
      roundDeltas: Array.from(game.roundDeltas.entries()),
      roundResults: game.roundResults
    });
  }

  function startNextRound(game) {
    game.readyPlayers.clear();
    game.skipVotes.clear();
    game.answers.clear();
    game.votes.clear();
    game.roundResults = [];
    game.whoPhase = { voteMap: new Map(), topTargetId: null, guessSubmissions: new Map() };
    initRoundDeltas(game);

    if (game.currentRound >= game.rounds) {
      const final = Array.from(game.scores.entries())
        .map(([playerId, score]) => ({ playerId, name: game.players.get(playerId)?.name || 'Player', score }))
        .sort((a,b) => b.score - a.score);
      game.state = 'game-over';
      game.gameInProgress = false;
      io.to(game.code).emit('game-over', { scores: final });
      return;
    }

    game.currentRound += 1;

    const q = game.questions[game.currentRound - 1];
    game.state = 'playing';

    io.to(game.code).emit('next-round', {
      round: game.currentRound,
      totalRounds: game.rounds,
      question: q.prompt,
      category: game.category
    });
  }

  function skipToNextRound(game) {
    resetRoundState(game);

    if (game.currentRound >= game.rounds) {
      const final = Array.from(game.scores.entries())
        .map(([playerId, score]) => ({ playerId, name: game.players.get(playerId)?.name || 'Player', score }))
        .sort((a,b) => b.score - a.score);
      game.state = 'game-over';
      game.gameInProgress = false;
      io.to(game.code).emit('game-over', { scores: final });
      return;
    }

    game.currentRound += 1;
    const q = game.questions[game.currentRound - 1];
    game.state = 'playing';
    io.to(game.code).emit('next-round', {
      round: game.currentRound,
      totalRounds: game.rounds,
      question: q.prompt,
      category: game.category
    });
  }
});

// --- start server ---
const PORT = process.env.PORT || 5174;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
