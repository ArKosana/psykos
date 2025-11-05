import React, { useState, useEffect } from 'react'
import socket from '../socket'

const ResultsScreen = ({ setCurrentScreen, gameState, playerInfo }) => {
  const [isReady, setIsReady] = useState(false)
  const [readyPlayers, setReadyPlayers] = useState([])
  const [totalPlayers, setTotalPlayers] = useState(0)

  useEffect(() => {
    const handlePlayerReadyUpdate = (data) => {
      setReadyPlayers(data.readyPlayers)
      setTotalPlayers(data.totalPlayers)
    }
    const handleReturnToLobby = (data) => {
      alert(`Game returned to lobby: ${data.reason}`)
      setCurrentScreen('lobby')
    }
    const handlePlayerLeft = (data) => {
      console.log(`${data.playerName} left the game`)
    }

    socket.on('player-ready-update', handlePlayerReadyUpdate)
    socket.on('return-to-lobby', handleReturnToLobby)
    socket.on('player-left', handlePlayerLeft)

    return () => {
      socket.off('player-ready-update', handlePlayerReadyUpdate)
      socket.off('return-to-lobby', handleReturnToLobby)
      socket.off('player-left', handlePlayerLeft)
    }
  }, [setCurrentScreen])

  const readyForNextRound = () => {
    if (!isReady) {
      socket.emit('player-ready', gameState.code)
      setIsReady(true)
    }
  }

  // Prefer server-provided roundResults + roundDeltas
  const deltasMap = new Map(gameState.roundDeltas || []) // [[playerId, delta]]
  const results = (gameState.roundResults || []).map(r => ({
    ...r,
    isYou: r.playerId === playerInfo.id
  }))

  // Fallback if server didn't send roundResults
  if (!results.length && gameState.answers && gameState.votes && gameState.players) {
    const playerMap = new Map(gameState.players.map(p => [p.id, p]))
    const temp = Array.from(gameState.answers).map(([pid, ans]) => ({
      playerId: pid,
      playerName: playerMap.get(pid)?.name || 'Unknown',
      delta: deltasMap.get(pid) || 0,
      detail: 'Votes received',
      isYou: pid === playerInfo.id
    }))
    results.push(...temp)
  }

  return (
    <div className="card">
      <div className="results-container">
        <div className="question-display">
          <h3>Round Results</h3>
          <p className="round-info">Round {gameState.round} of {gameState.totalRounds}</p>
        </div>

        <div className="results-section">
          {results.map((r) => (
            <div key={r.playerId} className={`player-result ${r.isYou ? 'you' : ''}`}>
              <div className="player-header">
                <span className="player-name">{r.isYou ? `YOU (${r.playerName})` : r.playerName}</span>
                <span className="player-score">{r.delta >= 0 ? '+' : ''}{r.delta} pts</span>
              </div>
              {r.detail && (
                <div className="votes-info">
                  {r.detail}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="action-buttons">
          {!isReady ? (
            <button className="btn" onClick={readyForNextRound}>
              READY FOR NEXT ROUND
            </button>
          ) : (
            <button className="btn ready" disabled>
              ✓ READY ({readyPlayers.length}/{totalPlayers})
            </button>
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
      </div>
    </div>
  )
}

export default ResultsScreen
