import React, { useState, useEffect } from 'react'
import socket from '../socket'
import WalkieTalkie from '../components/WalkieTalkie'

const GameScreen = ({ setCurrentScreen, gameState, playerInfo }) => {
  const [answer, setAnswer] = useState('')
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [answerCount, setAnswerCount] = useState({ submitted: 0, total: 0 })
  const [skipVotes, setSkipVotes] = useState({ skipVotes: 0, totalPlayers: 0 })

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

    const handleSkipVotesUpdate = (data) => {
      setSkipVotes(data)
    }

    socket.on('answer-count-update', handleAnswerCountUpdate)
    socket.on('skip-votes-update', handleSkipVotesUpdate)

    return () => {
      socket.off('answer-count-update', handleAnswerCountUpdate)
      socket.off('skip-votes-update', handleSkipVotesUpdate)
    }
  }, [gameState])

  const submitAnswer = () => {
    if (answer.trim()) {
      socket.emit('submit-answer', gameState.code, answer.trim())
      setHasSubmitted(true)
    }
  }

  const skipQuestion = () => {
    socket.emit('skip-question', gameState.code)
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
                  currentPlayerId={playerInfo?.id}
                />
              ))
            ) : (
              <div className="waiting-message">
                <p>Loading answers...</p>
              </div>
            )}
          </div>

          <div className="action-buttons">
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

          {/* Walkie Talkie - Always visible */}
          <div className="walkie-talkie-fixed">
            <WalkieTalkie />
          </div>
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
            
            <div className="game-actions">
              <button 
                className="btn"
                onClick={submitAnswer}
                disabled={!answer.trim()}
              >
                SUBMIT ANSWER
              </button>
              
              <button 
                className="btn skip-btn"
                onClick={skipQuestion}
              >
                SKIP QUESTION ({skipVotes.skipVotes}/{skipVotes.totalPlayers})
              </button>
            </div>
          </div>
        ) : (
          <div className="waiting-message">
            <p>Answer submitted! Waiting for other players...</p>
            <p>{answerCount.submitted} / {answerCount.total} players answered</p>
            <p>Skip votes: {skipVotes.skipVotes} / {skipVotes.totalPlayers}</p>
          </div>
        )}

        <div className="action-buttons">
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

        {/* Walkie Talkie - Always visible */}
        <div className="walkie-talkie-fixed">
          <WalkieTalkie />
        </div>
      </div>
    </div>
  )
}

const AnswerItem = ({ answer, index, gameCode, playerId, currentPlayerId }) => {
  const [selected, setSelected] = useState(false)

  const handleVote = () => {
    if (!selected && playerId !== currentPlayerId) {
      setSelected(true)
      socket.emit('submit-vote', gameCode, playerId)
    }
  }

  return (
    <div 
      className={`answer-item ${selected ? 'selected' : ''} ${playerId === currentPlayerId ? 'own-answer' : ''}`}
      onClick={handleVote}
    >
      <p className="answer-text">{answer}</p>
      {selected && <p className="vote-status">✓ Voted</p>}
      {playerId === currentPlayerId && <p className="own-answer-label">Your answer</p>}
    </div>
  )
}

export default GameScreen
