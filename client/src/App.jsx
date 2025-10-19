import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import GameScreen from './pages/GameScreen'
import ResultsScreen from './pages/ResultsScreen'
import GameOverScreen from './pages/GameOverScreen'
import HostPanel from './pages/HostPanel'
import socket from './socket'
import './styles.css'

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState('home')
  const [gameState, setGameState] = useState(null)
  const [playerInfo, setPlayerInfo] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
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

    socket.on('return-to-lobby', (data) => {
      console.log('Returning to lobby:', data)
      setGameState(prev => ({ ...prev, state: 'lobby' }))
      navigate('/lobby')
    })

    return () => {
      socket.off('game-state')
      socket.off('game-started')
      socket.off('start-voting')
      socket.off('show-results')
      socket.off('next-round')
      socket.off('game-over')
      socket.off('skip-votes-update')
      socket.off('return-to-lobby')
    }
  }, [navigate])

  const handleReturnToHome = () => {
    socket.disconnect()
    setGameState(null)
    setPlayerInfo(null)
    navigate('/')
    setShowMenu(false)
  }

  const handleReturnToLobby = () => {
    navigate('/lobby')
    setShowMenu(false)
  }

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
      case 'categories':
        return <HostPanel 
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
      {/* Header with Menu - Always Visible */}
      <header className="header">
        <button 
          className="menu-button"
          onClick={() => setShowMenu(true)}
        >
          ☰
        </button>
        
        {/* Branding in Header */}
        <div className="header-branding">
          <div className="brand-logo">PSYKOS</div>
          <div className="brand-tagline">BY KOSANA</div>
        </div>
      </header>

      {/* Menu Overlay */}
      <div className={`menu-overlay ${showMenu ? 'open' : ''}`} onClick={() => setShowMenu(false)}></div>
      
      {/* Side Menu */}
      <div className={`side-menu ${showMenu ? 'open' : ''}`}>
        <div className="menu-content">
          <h3>MENU</h3>
          
          {/* Return to Home - Show on all screens except home */}
          {currentScreen !== 'home' && (
            <div className="menu-item" onClick={handleReturnToHome}>
              RETURN TO HOME
            </div>
          )}

          {/* Return to Lobby - Show on game screens */}
          {(currentScreen === 'game' || currentScreen === 'results') && (
            <div className="menu-item" onClick={handleReturnToLobby}>
              RETURN TO LOBBY
            </div>
          )}

          <div className="menu-item" onClick={() => {
            setShowMenu(false)
            alert('HOW TO PLAY:\n\n1. CREATE OR JOIN A GAME\n2. CHOOSE A CATEGORY\n3. SUBMIT CREATIVE ANSWERS\n4. VOTE FOR THE BEST ANSWERS\n5. EARN POINTS FOR VOTES AND CORRECT GUESSES!')
          }}>
            HOW TO PLAY
          </div>
          
          <div className="menu-item" onClick={() => {
            setShowMenu(false)
            alert('NOTIFICATIONS SETTINGS WOULD GO HERE')
          }}>
            NOTIFICATIONS
          </div>
          
          <div className="menu-item" onClick={() => {
            setShowMenu(false)
            alert('GAME CREATED BY KOSANA\nVERSION 1.0')
          }}>
            ABOUT
          </div>

          {/* Exit Room - Show in lobby and game */}
          {(currentScreen === 'lobby' || currentScreen === 'game') && (
            <div className="menu-item" onClick={handleReturnToHome}>
              EXIT ROOM
            </div>
          )}
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
