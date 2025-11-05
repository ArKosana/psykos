import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, useNavigate, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import GameScreen from './pages/GameScreen'
import ResultsScreen from './pages/ResultsScreen'
import GameOverScreen from './pages/GameOverScreen'
import HostPanel from './pages/HostPanel'
import WhoVotedMe from './pages/WhoVotedMe'
import socket from './socket'
import './styles.css'

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState('home')
  const [gameState, setGameState] = useState(null)
  const [playerInfo, setPlayerInfo] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const path = location.pathname.split('/')[1] || 'home'
    setCurrentScreen(path)
  }, [location])

  useEffect(() => {
    socket.on('game-state', (state) => {
      setGameState(prev => ({ ...prev, ...state }))
    })

    socket.on('game-started', (data) => {
      setGameState(prev => ({ ...prev, ...data, state: 'playing' }))
      if (gameState?.code) navigate(`/game/${gameState.code}`)
    })

    socket.on('start-voting', (data) => {
      setGameState(prev => ({ 
        ...prev, 
        votingAnswers: data.answers,
        question: data.question,
        state: 'voting',
        category: data.category
      }))
    })

    socket.on('who-guess-phase', (payload) => {
      // payload: { round, totalRounds, question, summary:[{playerId,name,votes}], topTargetId }
      setGameState(prev => ({ ...prev, ...payload, state: 'who-guess' }))
      if (gameState?.code) navigate(`/game/${gameState.code}`)  // keep under /game route
    })

    socket.on('show-results', (results) => {
      setGameState(prev => ({ ...prev, ...results, state: 'results' }))
      if (gameState?.code) navigate(`/results/${gameState.code}`)
    })

    socket.on('next-round', (roundData) => {
      setGameState(prev => ({ ...prev, ...roundData, state: 'playing' }))
      if (gameState?.code) navigate(`/game/${gameState.code}`)
    })

    socket.on('game-over', (finalScores) => {
      setGameState(prev => ({ ...prev, ...finalScores, state: 'game-over' }))
      if (gameState?.code) navigate(`/over/${gameState.code}`)
    })

    socket.on('skip-votes-update', (data) => {
      setGameState(prev => ({ ...prev, skipVotes: data }))
    })

    socket.on('return-to-lobby', (data) => {
      setGameState(prev => ({ ...prev, state: 'lobby' }))
      if (gameState?.code) navigate(`/lobby/${gameState.code}`)
    })

    return () => {
      socket.off('game-state')
      socket.off('game-started')
      socket.off('start-voting')
      socket.off('who-guess-phase')
      socket.off('show-results')
      socket.off('next-round')
      socket.off('game-over')
      socket.off('skip-votes-update')
      socket.off('return-to-lobby')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, gameState?.code])

  const handleReturnToHome = () => {
    socket.disconnect()
    setGameState(null)
    setPlayerInfo(null)
    navigate('/home')
    setShowMenu(false)
  }

  const handleReturnToLobby = () => {
    if (gameState?.code) navigate(`/lobby/${gameState.code}`)
    setShowMenu(false)
  }

  const renderScreen = () => {
    if (currentScreen === 'game' && gameState?.state === 'who-guess') {
      return <WhoVotedMe gameState={gameState} playerInfo={playerInfo} />
    }

    switch (currentScreen) {
      case 'home':
        return <Home setCurrentScreen={setCurrentScreen} setGameState={setGameState} setPlayerInfo={setPlayerInfo} />
      case 'lobby':
        return <Lobby setCurrentScreen={setCurrentScreen} gameState={gameState} playerInfo={playerInfo} />
      case 'game':
        return <GameScreen setCurrentScreen={setCurrentScreen} gameState={gameState} playerInfo={playerInfo} />
      case 'results':
        return <ResultsScreen setCurrentScreen={setCurrentScreen} gameState={gameState} playerInfo={playerInfo} />
      case 'over':
      case 'game-over':
        return <GameOverScreen setCurrentScreen={setCurrentScreen} gameState={gameState} playerInfo={playerInfo} />
      case 'categories':
        return <HostPanel setCurrentScreen={setCurrentScreen} gameState={gameState} playerInfo={playerInfo} />
      default:
        return <Home setCurrentScreen={setCurrentScreen} setGameState={setGameState} setPlayerInfo={setPlayerInfo} />
    }
  }

  return (
    <div className="app">
      <header className="header">
        <button className="menu-button" onClick={() => setShowMenu(true)}>☰</button>
        <div className="header-branding">
          <div className="brand-logo">PSYKOS</div>
          <div className="brand-tagline">BY KOSANA</div>
        </div>
      </header>

      <div className={`menu-overlay ${showMenu ? 'open' : ''}`} onClick={() => setShowMenu(false)}></div>
      <div className={`side-menu ${showMenu ? 'open' : ''}`}>
        <div className="menu-content">
          <h3>MENU</h3>
          {currentScreen !== 'home' && <div className="menu-item" onClick={handleReturnToHome}>RETURN TO HOME</div>}
          {(currentScreen === 'game' || currentScreen === 'results') && (
            <div className="menu-item" onClick={handleReturnToLobby}>RETURN TO LOBBY</div>
          )}
          <div className="menu-item" onClick={() => { setShowMenu(false); alert('HOW TO PLAY…') }}>HOW TO PLAY</div>
          <div className="menu-item" onClick={() => { setShowMenu(false); alert('NOTIFICATIONS…') }}>NOTIFICATIONS</div>
          <div className="menu-item" onClick={() => { setShowMenu(false); alert('GAME CREATED BY KOSANA\\nVERSION 1.0') }}>ABOUT</div>
          {(currentScreen === 'lobby' || currentScreen === 'game') && <div className="menu-item" onClick={handleReturnToHome}>EXIT ROOM</div>}
        </div>
      </div>

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
