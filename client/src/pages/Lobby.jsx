import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import socket from '../socket'
import WalkieTalkie from '../components/WalkieTalkie'

const Lobby = ({ setCurrentScreen, gameState, playerInfo }) => {
  const [players, setPlayers] = useState([])
  const [rounds, setRounds] = useState(10)
  const [notification, setNotification] = useState('')
  const [gameInProgress, setGameInProgress] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const routeCode = params['*'] || location.pathname.split('/')[2] // support /lobby/ABCD and legacy

  useEffect(() => {
    // If we landed here without state, route has code -> bounce to home to rejoin
    if (!gameState?.code && routeCode) {
      navigate(`/home?code=${routeCode}`)
      return
    }

    if (gameState?.players) setPlayers(gameState.players)
    if (gameState?.gameInProgress) setGameInProgress(true)

    if (gameState?.code && playerInfo?.id) {
      socket.connect()
      socket.emit('join-game', { gameCode: gameState.code, playerId: playerInfo.id })
    }

    const handlePlayerJoined = (updatedPlayers) => setPlayers(updatedPlayers)
    const handlePlayersUpdated = (updatedPlayers) => setPlayers(updatedPlayers)
    const handleGameStarted = () => navigate(`/game/${gameState.code}`)
    const handleGameState = (state) => {
      if (state.players) setPlayers(state.players)
      if (state.gameInProgress) setGameInProgress(true)
    }
    const handlePlayerLeft = (data) => {
      setNotification(`${data.playerName} left the game`)
      setTimeout(() => setNotification(''), 3000)
    }
    const handleReturnToLobby = (data) => {
      setNotification(data.reason)
      setGameInProgress(false)
      setTimeout(() => setNotification(''), 5000)
    }
    const handleHostChanged = () => {
      setNotification('Host has been transferred to another player')
      setTimeout(() => setNotification(''), 3000)
    }

    socket.on('player-joined', handlePlayerJoined)
    socket.on('players-updated', handlePlayersUpdated)
    socket.on('game-started', handleGameStarted)
    socket.on('game-state', handleGameState)
    socket.on('player-left', handlePlayerLeft)
    socket.on('return-to-lobby', handleReturnToLobby)
    socket.on('host-changed', handleHostChanged)

    return () => {
      socket.off('player-joined', handlePlayerJoined)
      socket.off('players-updated', handlePlayersUpdated)
      socket.off('game-started', handleGameStarted)
      socket.off('game-state', handleGameState)
      socket.off('player-left', handlePlayerLeft)
      socket.off('return-to-lobby', handleReturnToLobby)
      socket.off('host-changed', handleHostChanged)
    }
  }, [gameState, playerInfo, navigate, routeCode])

  const startGame = () => {
    if (players.length >= 2) socket.emit('start-game', gameState.code)
    else alert('Need at least 2 players to start the game')
  }

  const copyCodeToClipboard = () => {
    if (gameState?.code) {
      const joinUrl = `${window.location.origin}/home?code=${gameState.code}`
      navigator.clipboard.writeText(joinUrl)
      alert(`Join link copied to clipboard!\n\nShare this link with friends:\n${joinUrl}`)
    }
  }

  return (
    <>
      <div className="background-logo">PSYKOS</div>
      <div className="background-tagline">BY KOSANA</div>

      <div className="bottom-branding">
        <div className="bottom-tagline">BY KOSANA</div>
      </div>

      <div className="lobby-container">
        {notification && <div className="notification">{notification}</div>}
        {gameInProgress && (
          <div className="notification warning">
            ⚠️ GAME IN PROGRESS! YOU CAN JOIN AND USE VOICE CHAT.
          </div>
        )}

        <div className="game-info-section">
          <div className="game-code-card" onClick={copyCodeToClipboard} title="Click to copy join link">
            <div className="game-code-header">JOIN CODE</div>
            <div className="game-code-text">{gameState?.code || 'LOADING...'}</div>
            <div className="game-code-label">CLICK TO COPY JOIN LINK</div>
          </div>

          {playerInfo?.isHost && !gameInProgress && (
            <div className="rounds-card">
              <div className="rounds-header">ROUNDS</div>
              <input 
                type="number" 
                min="1" 
                max="20" 
                value={rounds}
                onChange={(e) => setRounds(parseInt(e.target.value))}
                className="rounds-input"
                placeholder="10"
              />
            </div>
          )}
        </div>

        <div className="category-display">
          {gameState?.category ? gameState.category.replace(/-/g, ' ').toUpperCase() : 'LOADING CATEGORY...'}
        </div>

        <div className="players-section">
          <h3 className="players-label">PLAYERS ({players.length})</h3>
          <div className="players-container">
            {players.map(player => (
              <div 
                key={player.id}
                className={`player-bubble ${player.isHost ? 'host' : ''} ${players.length > 6 ? 'small' : ''}`}
                title={player.name + (player.isHost ? ' (Host)' : '')}
              >
                {player.avatar ? <img src={player.avatar} alt={player.name} /> : player.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {players.length === 0 && <p>WAITING FOR PLAYERS TO JOIN...</p>}
          </div>
        </div>

        <div className="action-buttons">
          {playerInfo?.isHost && !gameInProgress ? (
            <>
              <button className="btn" onClick={startGame} disabled={players.length < 2}>
                START GAME ({players.length}/2)
              </button>
              <p>MINIMUM 2 PLAYERS REQUIRED TO START</p>
            </>
          ) : gameInProgress ? (
            <div className="waiting-message">
              <p>GAME IN PROGRESS. YOU CAN USE VOICE CHAT BELOW.</p>
              <p>{players.length} PLAYER(S) IN GAME</p>
            </div>
          ) : (
            <div className="waiting-message">
              <p>WAITING FOR HOST TO START THE GAME...</p>
              <p>{players.length} PLAYER(S) IN LOBBY</p>
            </div>
          )}
        </div>
      </div>

      <div className="walkie-talkie-fixed">
        <WalkieTalkie />
      </div>
    </>
  )
}

export default Lobby
