import React, { useState, useRef } from 'react'

const API_URL = 'https://psykos-server-production.up.railway.app';
const Home = ({ setCurrentScreen, setGameState, setPlayerInfo }) => {
  const [showMenu, setShowMenu] = useState(false)
  const [showCreateGame, setShowCreateGame] = useState(false)
  const [showJoinGame, setShowJoinGame] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [gameCode, setGameCode] = useState('')
  const [playerAvatar, setPlayerAvatar] = useState(null)
  const [soundMuted, setSoundMuted] = useState(false)
  const fileInputRef = useRef(null)

  const categories = [
    {
      id: 'caption-this',
      name: 'CAPTION THIS!',
      description: 'Create hilarious captions for funny images'
    },
    {
      id: 'acronyms', 
      name: 'ACRONYMS',
      description: 'Guess the real meaning of common acronyms'
    },
    {
      id: 'is-that-a-fact',
      name: 'IS THAT A FACT?',
      description: 'Separate surprising facts from clever fakes'
    },
    {
      id: 'truth-comes-out',
      name: 'THE TRUTH COMES OUT',
      description: 'Personal questions about the players'
    },
    {
      id: 'search-history',
      name: 'SEARCH HISTORY',
      description: 'Complete funny search queries'
    },
    {
      id: 'ice-breaker',
      name: 'ICE BREAKER',
      description: 'Fun get-to-know-you questions'
    },
    {
      id: 'naked-truth',
      name: 'THE NAKED TRUTH',
      description: 'Adult-themed personal questions (18+)'
    }
  ]

  const handleAvatarUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setPlayerAvatar(e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const triggerAvatarUpload = () => {
    fileInputRef.current?.click()
  }

  const createGame = async (category) => {
    if (!playerName.trim()) {
      alert('Please enter your name')
      return
    }

    try {
      const response = await fetch('${API_URL}/create-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: playerName.trim(),
          category: category.id,
          rounds: 10
        })
      })

      const data = await response.json()
      
      setPlayerInfo({
        id: data.playerId,
        name: playerName.trim(),
        avatar: playerAvatar,
        isHost: true
      })
      
      // Set gameState with ALL necessary properties
      setGameState({
        code: data.gameCode,
        category: data.category,
        players: [{
          id: data.playerId,
          name: playerName.trim(),
          avatar: playerAvatar,
          isHost: true
        }],
        state: 'lobby'
      })
      
      setCurrentScreen('lobby')
    } catch (error) {
      console.error('Error creating game:', error)
      alert('Failed to create game. Please try again.')
    }
  }

  const joinGame = async () => {
    if (!playerName.trim() || !gameCode.trim()) {
      alert('Please enter your name and game code')
      return
    }

    try {
      const response = await fetch('${API_URL}/join-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameCode: gameCode.trim().toUpperCase(),
          playerName: playerName.trim()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to join game')
      }

      const data = await response.json()
      
      setPlayerInfo({
        id: data.playerId,
        name: playerName.trim(),
        avatar: playerAvatar,
        isHost: false
      })
      
      // Set gameState for joining player
      setGameState({
        code: gameCode.trim().toUpperCase(),
        category: data.category,
        players: [], // Will be populated by socket events
        state: 'lobby'
      })
      
      setCurrentScreen('lobby')
    } catch (error) {
      console.error('Error joining game:', error)
      alert('Failed to join game. Please check the code and try again.')
    }
  }

  return (
    <>
      <div className="background-logo">PSYKOS</div>
      <div className="background-tagline">by kosana</div>

      <header className="header">
        <button 
          className="menu-button"
          onClick={() => setShowMenu(true)}
        >
          ☰
        </button>
        
        <div style={{width: '40px'}}></div>
      </header>

      <div className={`menu-overlay ${showMenu ? 'open' : ''}`} onClick={() => setShowMenu(false)}></div>
      
      <div className={`side-menu ${showMenu ? 'open' : ''}`}>
        <div className="menu-content">
          <h3>MENU</h3>
          
          <div className="menu-item" onClick={() => setSoundMuted(!soundMuted)}>
            SOUND: {soundMuted ? '🔇 MUTED' : '🔊 ON'}
          </div>
          
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
        </div>
      </div>

      <div className="card">
        {!showCreateGame && !showJoinGame && (
          <>
            <div className="text-center">
              <h2>ENTER YOUR NAME</h2>
            </div>

            <input
              type="text"
              placeholder="PLAYER NAME"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="player-input"
              maxLength={15}
            />

            <div className="avatar-upload">
              <div className="avatar-preview" onClick={triggerAvatarUpload}>
                {playerAvatar ? (
                  <img src={playerAvatar} alt="Player avatar" />
                ) : (
                  playerName ? playerName.charAt(0).toUpperCase() : '?'
                )}
              </div>
              <button className="upload-btn" onClick={triggerAvatarUpload}>
                UPLOAD PHOTO
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>

            <div className="flex flex-column">
              <button 
                className="btn"
                onClick={() => setShowCreateGame(true)}
                disabled={!playerName.trim()}
              >
                CREATE GAME
              </button>
              <button 
                className="btn"
                onClick={() => setShowJoinGame(true)}
                disabled={!playerName.trim()}
              >
                JOIN GAME
              </button>
            </div>
          </>
        )}

        {showCreateGame && (
          <>
            <div className="text-center">
              <h2>CHOOSE CATEGORY</h2>
              <p>SELECT A GAME CATEGORY</p>
            </div>

            <div className="category-list">
              {categories.map(category => (
                <div 
                  key={category.id}
                  className="category-item"
                  onClick={() => createGame(category)}
                >
                  <h3>{category.name}</h3>
                  <p>{category.description}</p>
                </div>
              ))}
            </div>

            <button 
              className="btn"
              onClick={() => setShowCreateGame(false)}
            >
              BACK
            </button>
          </>
        )}

        {showJoinGame && (
          <>
            <div className="text-center">
              <h2>JOIN GAME</h2>
              <p>ENTER THE GAME CODE SHARED BY THE HOST</p>
            </div>

            <input
              type="text"
              placeholder="ENTER CODE"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              className="player-input"
              style={{
                fontSize: '1.3rem',
                letterSpacing: '0.3rem',
                textTransform: 'uppercase'
              }}
              maxLength={4}
            />

            <button 
              className="btn"
              onClick={joinGame}
            >
              JOIN GAME
            </button>

            <button 
              className="btn"
              onClick={() => setShowJoinGame(false)}
            >
              BACK
            </button>
          </>
        )}
      </div>
    </>
  )
}

export default Home
