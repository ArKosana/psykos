import React from 'react'
import GameScreen from './GameScreen'

function PlayerView({ gameData, playerData }) {
  // Player view is now handled by GameScreen component
  return <GameScreen gameData={gameData} playerData={playerData} />
}

export default PlayerView
