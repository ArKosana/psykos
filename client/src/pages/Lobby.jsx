import React, { useState, useEffect } from 'react'
import socket from '../socket'
import WalkieTalkie from '../components/WalkieTalkie'

const Lobby = ({ setCurrentScreen, gameState, playerInfo }) => {
  const [players, setPlayers] = useState([])
  const [rounds, setRounds] = useState(10)
  const [notification, setNotification] = useState('')
  const [gameInProgress, setGameInProgress] = useState(false)

  console.log('🔍 Lobby Debug - GameState:', gameState)
  console.log('🔍 Lobby Debug - PlayerInfo:', playerInfo)

  useEffect(() => {
    // Set initial players from gameState
    if (gameState?.players) {
      console.log('🎮 Setting initial players:', gameState.players)
      setPlayers(gameState.players)
    }

    if (gameState?.gameInProgress) {
      setGameInProgress(true)
    }

    // Join game room
    if (gameState?.code && playerInfo?.id) {
      console.log('🚀 Joining game room:', gameState.code, 'Player:', playerInfo.id)
      
      // CONNECT SOCKET FIRST
      socket.connect();
      
      socket.emit('join-game', {
        gameCode: gameState.code,
        playerId: playerInfo.id
      })
    }

    // Socket event listeners
    const handlePlayerJoined = (updatedPlayers) => {
      console.log('👥 Player joined - updated players:', updatedPlayers)
      setPlayers(updatedPlayers)
    }

    const handlePlayersUpdated = (updatedPlayers) => {
      console.log('🔄 Players updated:', updatedPlayers)
      setPlayers(updatedPlayers)
    }

    const handleGameStarted = (data) => {
      console.log('🎯 Game started with data:', data)
      setCurrentScreen('game')
    }

    const handleGameState = (state) => {
      console.log('📋 Received game state:', state)
      if (state.players) {
        setPlayers(state.players)
      }
      if (state.gameInProgress) {
        setGameInProgress(true)
      }
    }

    const handlePlayerLeft = (data) => {
      console.log('👋 Player left:', data.playerName)
      setNotification(`${data.playerName} left the game`)
      setTimeout(() => setNotification(''), 3000)
    }

    const handleReturnToLobby = (data) => {
      console.log('🏠 Returning to lobby:', data.reason)
      setNotification(data.reason)
      setGameInProgress(false)
      setTimeout(() => setNotification(''), 5000)
    }

    // Listen for connection events
    const handleConnect = () => {
      console.log('✅ Socket connected!')
    }

    const handleDisconnect = () => {
      console.log('❌ Socket disconnected!')
    }

    // Set up all event listeners
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('player-joined', handlePlayerJoined)
    socket.on('players-updated', handlePlayersUpdated)
    socket.on('game-started', handleGameStarted)
    socket.on('game-state', handleGameState)
    socket.on('player-left', handlePlayerLeft)
    socket.on('return-to-lobby', handleReturnToLobby)

    return () => {
      // Clean up all event listeners
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('player-joined', handlePlayerJoined)
      socket.off('players-updated', handlePlayersUpdated)
      socket.off('game-started', handleGameStarted)
      socket.off('game-state', handleGameState)
      socket.off('player-left', handlePlayerLeft)
      socket.off('return-to-lobby', handleReturnToLobby)
    }
  }, [gameState, playerInfo, setCurrentScreen])

  const startGame = () => {
    if (players.length >= 2) {
      console.log('▶️ Starting game with code:', gameState.code)
      socket.emit('start-game', gameState.code)
    } else {
      alert('Need at least 2 players to start the game')
    }
  }

  const copyCodeToClipboard = () => {
    if (gameState?.code) {
      navigator.clipboard.writeText(gameState.code)
      alert(`Game code ${gameState.code} copied to clipboard!`)
    }
  }

  return (
    <>
      {/* Background Branding - Massive and Bright */}
      <div className="background-logo">PSYKOS</div>
      <div className="background-tagline">by kosana</div>

      <div className="card">
        <div className="lobby-container">
          
          {/* Notification */}
          {notification && (
            <div className="notification">
              {notification}
            </div>
          )}

          {/* Game In Progress Warning */}
          {gameInProgress && (
            <div className="notification warning">
              ⚠️ Game in progress! You can join and use voice chat.
            </div>
          )}

          {/* Game Code and Rounds Input - Top Section */}
          <div className="game-code-section">
            <div className="game-code-display" onClick={copyCodeToClipboard} title="Click to copy code">
              <div className="game-code-text">
                {gameState?.code || 'LOADING...'}
              </div>
              <p className="game-code-label">CLICK TO COPY</p>
            </div>

            {/* Rounds Selection - Host Only */}
            {playerInfo?.isHost && !gameInProgress && (
              <div className="rounds-input">
                <label>ROUNDS:</label>
                <input 
                  type="number" 
                  min="1" 
                  max="20" 
                  value={rounds}
                  onChange={(e) => setRounds(parseInt(e.target.value))}
                  placeholder="10"
                />
              </div>
            )}
          </div>

          {/* Category Display */}
          <div className="category-display">
            {gameState?.category ? gameState.category.replace(/-/g, ' ').toUpperCase() : 'LOADING CATEGORY...'}
          </div>

          {/* Players Section */}
          <div className="players-section">
            <h3 className="players-label">PLAYERS ({players.length})</h3>
            <div className="players-container">
              {players.map(player => (
                <div 
                  key={player.id}
                  className={`player-bubble ${player.isHost ? 'host' : ''} ${players.length > 6 ? 'small' : ''}`}
                  title={player.name + (player.isHost ? ' (Host)' : '')}
                >
                  {player.avatar ? (
                    <img src={player.avatar} alt={player.name} />
                  ) : (
                    player.name.charAt(0).toUpperCase()
                  )}
                </div>
              ))}
              {players.length === 0 && (
                <p>Waiting for players to join...</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            {playerInfo?.isHost && !gameInProgress ? (
              <>
                <button 
                  className="btn" 
                  onClick={startGame} 
                  disabled={players.length < 2}
                >
                  START GAME ({players.length}/2)
                </button>
                <p>Minimum 2 players required to start</p>
              </>
            ) : gameInProgress ? (
              <div className="waiting-message">
                <p>Game in progress. You can use voice chat below.</p>
                <p>{players.length} player(s) in game</p>
              </div>
            ) : (
              <div className="waiting-message">
                <p>Waiting for host to start the game...</p>
                <p>{players.length} player(s) in lobby</p>
              </div>
            )}

            <button 
              className="btn" 
              onClick={() => {
                socket.disconnect()
                setCurrentScreen('home')
              }}
            >
              LEAVE GAME
            </button>
          </div>

          {/* Walkie Talkie - Always visible in lobby */}
          <div className="walkie-talkie-lobby">
            <WalkieTalkie />
            <p className="walkie-talkie-label">Hold to talk to other players</p>
          </div>
        </div>
      </div>
    </>
  )
}

export default Lobby
