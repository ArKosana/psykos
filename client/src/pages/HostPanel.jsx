import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import socket from '../socket'
import WalkieTalkie from '../components/WalkieTalkie'

function HostPanel({ gameState, playerInfo }) {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const navigate = useNavigate()

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
    },
    {
      id: 'who-among-us',
      name: 'WHO AMONG US',
      description: 'Guess who fits the description'
    }
  ]

  const selectCategory = (category) => {
    setSelectedCategory(category)
    // Auto-confirm category selection
    confirmCategory(category)
  }

  const confirmCategory = (category) => {
    if (gameState?.code) {
      socket.emit('select-category', {
        gameCode: gameState.code,
        categoryId: category.id
      })
      // Navigate back to lobby after category selection
      navigate('/lobby')
    }
  }

  return (
    <>
      <div className="background-logo">PSYKOS</div>
      <div className="background-tagline">BY KOSANA</div>

      {/* Bottom Branding */}
      <div className="bottom-branding">
        <div className="bottom-tagline">BY KOSANA</div>
      </div>

      <div className="category-list-container">
        <div className="screen-heading">
          <h2>CHOOSE CATEGORY</h2>
          <p>SELECT A GAME CATEGORY</p>
        </div>

        <div className="category-list">
          {categories.map(category => (
            <div 
              key={category.id}
              className={`category-item ${selectedCategory?.id === category.id ? 'selected' : ''}`}
              onClick={() => selectCategory(category)}
            >
              <h3>{category.name}</h3>
              <p>{category.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Walkie Talkie - Fixed position */}
      <div className="walkie-talkie-fixed">
        <WalkieTalkie />
      </div>
    </>
  )
}

export default HostPanel
