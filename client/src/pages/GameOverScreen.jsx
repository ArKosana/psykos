import React from 'react'

const GameOverScreen = ({ setCurrentScreen, gameState, playerInfo }) => {
  const sortedScores = gameState.scores?.sort((a, b) => b.score - a.score) || []

  return (
    <div className="card">
      <div className="results-container">
        <div className="question-display">
          <h2>GAME OVER!</h2>
          <p className="round-info">Final Results</p>
        </div>

        <div className="results-section">
          {sortedScores.map((player, index) => (
            <div 
              key={player.playerId}
              className={`player-result ${player.playerId === playerInfo.id ? 'you' : ''}`}
            >
              <div className="player-header">
                <span className="player-name">
                  {index + 1}. {player.name} {player.playerId === playerInfo.id && '(YOU)'} {index === 0 && '👑'}
                </span>
                <span className="player-score">{player.score} pts</span>
              </div>
              {index === 0 && player.playerId === playerInfo.id && (
                <div className="answer-content" style={{color: 'var(--accent-blue)'}}>
                  🎉 CONGRATULATIONS! YOU WON! 🎉
                </div>
              )}
              {index === 0 && player.playerId !== playerInfo.id && (
                <div className="answer-content" style={{color: 'var(--accent-blue)'}}>
                  🏆 WINNER! 🏆
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="action-buttons">
          <button 
            className="btn"
            onClick={() => setCurrentScreen('home')}
          >
            PLAY AGAIN
          </button>
        </div>
      </div>
    </div>
  )
}

export default GameOverScreen
