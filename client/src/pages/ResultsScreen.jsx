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

  // Process results data
  const getPlayerResults = () => {
    if (!gameState.answers || !gameState.votes || !gameState.players) return []

    const playerMap = new Map(gameState.players.map(p => [p.id, p]))
    
    return Array.from(gameState.answers).map(([answerPlayerId, answer]) => {
      const player = playerMap.get(answerPlayerId)
      const voters = Array.from(gameState.votes)
        .filter(([voterId, votedId]) => votedId === answerPlayerId)
        .map(([voterId]) => playerMap.get(voterId)?.name || 'Unknown')
      
      const yourVote = Array.from(gameState.votes).find(([voterId]) => voterId === playerInfo.id)?.[1]
      const youVotedForThis = yourVote === answerPlayerId
      const votedForYou = voters.some(voter => voter === playerInfo.name)

      return {
        playerId: answerPlayerId,
        playerName: player?.name || 'Unknown',
        answer: answer,
        voters: voters,
        isYou: answerPlayerId === playerInfo.id,
        youVotedForThis: youVotedForThis,
        votedForYou: votedForYou,
        score: gameState.scores?.find(([id]) => id === answerPlayerId)?.[1] || 0
      }
    })
  }

  const playerResults = getPlayerResults()
  const yourResult = playerResults.find(r => r.isYou)

  return (
    <div className="card">
      <div className="results-container">
        <div className="question-display">
          <h3>Round Results</h3>
          <p className="round-info">Round {gameState.round} of {gameState.totalRounds}</p>
        </div>

        <div className="results-section">
          {/* Your specific results */}
          {yourResult && (
            <div className="player-result you">
              <div className="player-header">
                <span className="player-name">YOU ({yourResult.playerName})</span>
                <span className="player-score">+{yourResult.voters.length * 10} pts</span>
              </div>
              <div className="answer-content">
                <strong>Your answer:</strong> {yourResult.answer}
              </div>
              <div className="votes-info">
                <strong>Who voted for you:</strong> {yourResult.voters.length > 0 ? yourResult.voters.join(', ') : 'No one voted for you'}
              </div>
              {yourResult.youVotedForThis && (
                <div className="votes-info">
                  <strong>You voted for:</strong> Yourself ✓
                </div>
              )}
            </div>
          )}

          {/* Other players' answers that you voted for */}
          {playerResults.filter(r => !r.isYou && r.youVotedForThis).map(result => (
            <div key={result.playerId} className="player-result">
              <div className="player-header">
                <span className="player-name">{result.playerName}</span>
                <span className="player-score">+{result.voters.length * 10} pts</span>
              </div>
              <div className="answer-content">
                <strong>Their answer:</strong> {result.answer}
              </div>
              <div className="votes-info">
                <strong>You voted for this answer ✓</strong>
              </div>
            </div>
          ))}

          {/* All other answers */}
          {playerResults.filter(r => !r.isYou && !r.youVotedForThis).map(result => (
            <div key={result.playerId} className="player-result">
              <div className="player-header">
                <span className="player-name">{result.playerName}</span>
                <span className="player-score">+{result.voters.length * 10} pts</span>
              </div>
              <div className="answer-content">
                <strong>Their answer:</strong> {result.answer}
              </div>
            </div>
          ))}
        </div>

        <div className="action-buttons">
          {!isReady ? (
            <button 
              className="btn"
              onClick={readyForNextRound}
            >
              READY FOR NEXT ROUND
            </button>
          ) : (
            <button 
              className="btn ready"
              disabled
            >
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
