import React, { useState } from 'react'
import { socket } from '../socket'

function HostPanel({ gameData, playerData, onLeaveGame, error }) {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const categories = [
    {
      id: 'caption-this',
      name: 'CAPTION THIS',
      description: 'Create funny captions for images'
    },
    {
      id: 'acronyms', 
      name: 'ACRONYMS',
      description: 'Guess the real acronym meaning'
    },
    {
      id: 'is-that-a-fact',
      name: 'IS THAT A FACT?',
      description: 'Separate facts from fiction'
    },
    {
      id: 'truth-comes-out',
      name: 'TRUTH COMES OUT',
      description: 'Personal questions about players'
    },
    {
      id: 'search-history',
      name: 'SEARCH HISTORY',
      description: 'Complete the search query'
    },
    {
      id: 'ice-breaker',
      name: 'ICE BREAKER',
      description: 'Get to know each other'
    },
    {
      id: 'naked-truth',
      name: 'NAKED TRUTH (18+)',
      description: 'Adult personal questions'
    }
  ]

  const selectCategory = (category) => {
    setSelectedCategory(category)
    setShowConfirm(true)
  }

  const confirmCategory = () => {
    socket.emit('select-category', {
      gameId: gameData.id,
      categoryId: selectedCategory.id
    })
    setShowConfirm(false)
  }

  const startRound = () => {
    if (!selectedCategory) {
      alert('Please select a category first!')
      return
    }
    console.log('Starting round with category:', selectedCategory.name)
    socket.emit('start-round', {
      gameId: gameData.id
    })
  }

  return (
    <div className="screen-container">
      <div className="content-wrapper">
        {/* Header */}
        <div className="lobby-header">
          <div>
            <h1>HOST PANEL</h1>
            <div className="tagline">Round {gameData?.currentRound || 1} of {gameData?.totalRounds || 10}</div>
          </div>
          <div className="game-code">Code: {gameData?.id}</div>
        </div>

        {/* Categories - Vertical Scrollable */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          marginBottom: '1rem'
        }}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.75rem',
            padding: '0.5rem'
          }}>
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => selectCategory(category)}
                style={{
                  background: selectedCategory?.id === category.id ? 'var(--primary)' : 'var(--surface)',
                  border: '2px solid',
                  borderColor: selectedCategory?.id === category.id ? 'var(--primary)' : 'var(--border)',
                  color: selectedCategory?.id === category.id ? 'white' : 'var(--text)',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '1rem',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                  {category.name}
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  {category.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Category Display */}
        {selectedCategory && (
          <div style={{
            background: 'var(--surface)',
            padding: '1rem',
            borderRadius: '12px',
            marginBottom: '1rem',
            border: '2px solid var(--primary)'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
              Selected: {selectedCategory.name}
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
              {selectedCategory.description}
            </div>
          </div>
        )}

        {/* Start Round Button */}
        {selectedCategory && (
          <button 
            onClick={startRound}
            className="btn btn-primary"
            style={{ marginBottom: '1rem' }}
          >
            START ROUND {gameData?.currentRound || 1}
          </button>
        )}

        {/* Leave Game Button */}
        <button onClick={onLeaveGame} className="btn btn-leave">
          Leave Game
        </button>

        {/* Walkie Talkie */}
        <WalkieTalkieButton />

        {/* Category Confirmation Modal */}
        {showConfirm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div style={{
              background: 'var(--surface)',
              padding: '2rem',
              borderRadius: '16px',
              maxWidth: '400px',
              width: '100%',
              textAlign: 'center'
            }}>
              <h3 style={{ marginBottom: '1rem' }}>Confirm Category</h3>
              <p style={{ marginBottom: '2rem', opacity: 0.8 }}>
                Start round with <strong>{selectedCategory?.name}</strong>?
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="btn"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmCategory}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Walkie Talkie Component
function WalkieTalkieButton() {
  const [isTalking, setIsTalking] = useState(false)

  const startTalking = () => {
    setIsTalking(true)
    socket.emit('voice-start')
  }

  const stopTalking = () => {
    setIsTalking(false)
    socket.emit('voice-end')
  }

  return (
    <button 
      className="walkie-talkie"
      title="Hold to talk"
      onMouseDown={startTalking}
      onMouseUp={stopTalking}
      onMouseLeave={stopTalking}
      onTouchStart={startTalking}
      onTouchEnd={stopTalking}
      style={{
        background: isTalking ? 'var(--success)' : 'var(--primary)',
        transform: isTalking ? 'scale(0.95)' : 'scale(1)'
      }}
    >
      🎤
    </button>
  )
}

export default HostPanel
