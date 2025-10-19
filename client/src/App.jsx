import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import GameScreen from './pages/GameScreen'
import ResultsScreen from './pages/ResultsScreen'
import GameOverScreen from './pages/GameOverScreen'
import socket from './socket'
import './styles.css'

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState('home')
  const [gameState, setGameState] = useState(null)
  const [playerInfo, setPlayerInfo] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  // Sync routing with screen state
  useEffect(() => {
    const path = location.pathname.replace('/', '') || 'home'
    setCurrentScreen(path)
  }, [location])

  useEffect(() => {
    // Socket event listeners
    socket.on('game-state', (state) => {
      console.log('Game state received:', state)
      setGameState(prev => ({ ...prev, ...state }))
    })

    socket.on('game-started', (data) => {
      console.log('Game started:', data)
      setGameState(prev => ({ ...prev, ...data, state: 'playing' }))
      navigate('/game')
    })

    socket.on('start-voting', (data) => {
      console.log('Starting voting:', data)
      setGameState(prev => ({ 
        ...prev, 
        votingAnswers: data.answers,
        question: data.question,
        state: 'voting' 
      }))
    })

    socket.on('show-results', (results) => {
      console.log('Showing results:', results)
      setGameState(prev => ({ ...prev, ...results, state: 'results' }))
      navigate('/results')
    })

    socket.on('next-round', (roundData) => {
      console.log('Next round:', roundData)
      setGameState(prev => ({ ...prev, ...roundData, state: 'playing' }))
      navigate('/game')
    })

    socket.on('game-over', (finalScores) => {
      console.log('Game over:', finalScores)
      setGameState(prev => ({ ...prev, ...finalScores, state: 'game-over' }))
      navigate('/game-over')
    })

    socket.on('skip-votes-update', (data) => {
      console.log('Skip votes update:', data)
      setGameState(prev => ({ ...prev, skipVotes: data }))
    })

    return () => {
      socket.off('game-state')
      socket.off('game-started')
      socket.off('start-voting')
      socket.off('show-results')
      socket.off('next-round')
      socket.off('game-over')
      socket.off('skip-votes-update')
    }
  }, [navigate])

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <Home 
          setCurrentScreen={setCurrentScreen} 
          setGameState={setGameState} 
          setPlayerInfo={setPlayerInfo} 
        />
      case 'lobby':
        return <Lobby 
          setCurrentScreen={setCurrentScreen} 
          gameState={gameState} 
          playerInfo={playerInfo} 
        />
      case 'game':
        return <GameScreen 
          setCurrentScreen={setCurrentScreen} 
          gameState={gameState} 
          playerInfo={playerInfo} 
        />
      case 'results':
        return <ResultsScreen 
          setCurrentScreen={setCurrentScreen} 
          gameState={gameState} 
          playerInfo={playerInfo} 
        />
      case 'game-over':
        return <GameOverScreen 
          setCurrentScreen={setCurrentScreen} 
          gameState={gameState} 
          playerInfo={playerInfo} 
        />
      default:
        return <Home 
          setCurrentScreen={setCurrentScreen} 
          setGameState={setGameState} 
          setPlayerInfo={setPlayerInfo} 
        />
    }
  }

  return (
    <div className="app">
      <main className="main-content">
        {renderScreen()}
      </main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
