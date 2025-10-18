import React, { useState, useEffect } from 'react'
import socket from '../socket'

const GameScreen = ({ setCurrentScreen, gameState, playerInfo }) => {
  const [answer, setAnswer] = useState('')
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [answerCount, setAnswerCount] = useState({ submitted: 0, total: 0 })

  useEffect(() => {
    // Set initial answer count
    if (gameState?.players) {
      setAnswerCount({
        submitted: 0,
        total: gameState.players.length
      })
    }

    const handleAnswerCountUpdate = (data) => {
      setAnswerCount(data)
    }

    socket.on('answer-count-update', handleAnswerCountUpdate)

    return () => {
      socket.off('answer-count-update', handleAnswerCountUpdate)
    }
  }, [gameState])

  const submitAnswer = () => {
    if (answer.trim()) {
      socket.emit('submit-answer', gameState.code, answer.trim())
      setHasSubmitted(true)
    }
  }

  // Handle voting state
  if (gameState?.state === 'voting') {
    const votingAnswers = Array.isArray(gameState.votingAnswers) 
      ? gameState.votingAnswers 
      : (gameState.votingAnswers?.answers || [])

    return (
      <div className="card">
        <div className="voting-container">
          <div className="question-display">
            <h3 className="question-text">{gameState.question || gameState.votingAnswers?.question}</h3>
            <p className="round-info">Round {gameState.round} of {gameState.totalRounds}</p>
          </div>

          <h3>Vote for the Best Answer:</h3>
          
          <div className="answers-list">
            {votingAnswers.length > 0 ? (
              votingAnswers.map((item, index) => (
                <AnswerItem 
                  key={index}
                  answer={item.answer}
                  index={index}
                  gameCode={gameState.code}
                  playerId={item.playerId}
                />
              ))
            ) : (
              <div className="waiting-message">
                <p>Loading answers...</p>
              </div>
            )}
          </div>

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
    )
  }

  return (
    <div className="card">
      <div className="game-container">
        <div className="question-display">
          <h3 className="question-text">{gameState?.question}</h3>
          <p className="round-info">Round {gameState?.round} of {gameState?.totalRounds}</p>
        </div>

        {!hasSubmitted ? (
          <div className="answer-input">
            <textarea
              placeholder="Type your answer here..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="answer-textarea"
              maxLength={500}
            />
            <button 
              className="btn"
              onClick={submitAnswer}
              disabled={!answer.trim()}
            >
              SUBMIT ANSWER
            </button>
          </div>
        ) : (
          <div className="waiting-message">
            <p>Answer submitted! Waiting for other players...</p>
            <p>{answerCount.submitted} / {answerCount.total} players answered</p>
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
    </div>
  )
}

const AnswerItem = ({ answer, index, gameCode, playerId }) => {
  const [selected, setSelected] = useState(false)

  const handleVote = () => {
    if (!selected) {
      setSelected(true)
      socket.emit('submit-vote', gameCode, playerId)
    }
  }

  return (
    <div 
      className={`answer-item ${selected ? 'selected' : ''}`}
      onClick={handleVote}
    >
      <p className="answer-text">{answer}</p>
      {selected && <p style={{fontSize: '0.7rem', margin: '0.5rem 0 0 0'}}>✓ Voted</p>}
    </div>
  )
}

export default GameScreen
