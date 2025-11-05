import React, { useMemo, useState } from 'react'
import socket from '../socket'
import WalkieTalkie from '../components/WalkieTalkie'

/**
 * WhoVotedMe
 * - Shows vote counts for each player (no identities).
 * - If you received K votes, you must pick exactly K players who you think voted for you.
 * - If you received 0 votes, you must guess who voted for the top-voted player (topTargetId).
 * - Submit 'who-guess-submit' with { targetId, guesses[] }.
 */
export default function WhoVotedMe({ gameState, playerInfo }) {
  const summary = gameState?.summary || []
  const topTargetId = gameState?.topTargetId

  const you = playerInfo?.id
  const youVotes = useMemo(() => summary.find(s => s.playerId === you)?.votes || 0, [summary, you])

  // The target you are guessing voters for: either yourself if you had votes, else topTargetId
  const targetId = youVotes > 0 ? you : topTargetId

  // Number of guesses required == number of votes the target received
  const required = useMemo(() => {
    const t = summary.find(s => s.playerId === targetId)
    return t ? t.votes : 0
  }, [summary, targetId])

  const players = useMemo(() => {
    // All players except yourself (can't guess self)
    return (gameState?.players || []).filter(p => p.id !== you)
  }, [gameState?.players, you])

  const [selected, setSelected] = useState([])

  const toggle = (pid) => {
    setSelected(prev => {
      if (prev.includes(pid)) return prev.filter(x => x !== pid)
      if (prev.length >= required) return prev // limit
      return [...prev, pid]
    })
  }

  const submit = () => {
    if (required === 0) {
      // No guesses required — submit empty
      socket.emit('who-guess-submit', { gameCode: gameState.code, targetId, guesses: [] })
      return
    }
    if (selected.length !== required) {
      alert(`Select exactly ${required} player(s).`)
      return
    }
    socket.emit('who-guess-submit', { gameCode: gameState.code, targetId, guesses: selected })
  }

  return (
    <div className="card">
      <div className="question-display">
        <h3 className="question-text">{gameState?.question}</h3>
        <p className="round-info">Round {gameState?.round} of {gameState?.totalRounds}</p>
      </div>

      <div className="who-summary">
        <h3>Votes Summary</h3>
        <div className="players-container" style={{gap:'12px', flexWrap:'wrap', justifyContent:'center'}}>
          {summary.map(s => (
            <div key={s.playerId} className={`player-bubble ${s.playerId === topTargetId ? 'host' : ''}`}>
              <div style={{fontSize:'0.8rem'}}>{s.name}</div>
              <div style={{fontSize:'1.1rem', marginTop:'4px'}}>{s.votes} vote(s)</div>
            </div>
          ))}
        </div>
      </div>

      <div className="who-guess">
        <h3 style={{marginTop:'16px'}}>
          {youVotes > 0 
            ? `You received ${youVotes} vote(s). Guess exactly who voted for you.` 
            : `You received no votes. Guess who voted for the top player.`}
        </h3>

        <p style={{opacity:0.8, margin:'8px 0'}}>
          Select <strong>{required}</strong> player{required === 1 ? '' : 's'}:
        </p>

        <div className="answers-list">
          {players.map(p => (
            <div 
              key={p.id} 
              className={`answer-item ${selected.includes(p.id) ? 'selected' : ''}`}
              onClick={() => toggle(p.id)}
            >
              <p className="answer-text">{p.name}</p>
            </div>
          ))}
        </div>

        <div className="action-buttons">
          <button className="btn" onClick={submit}>
            SUBMIT GUESSES {required > 0 ? `(${selected.length}/${required})` : ''}
          </button>
        </div>
      </div>

      <div className="walkie-talkie-fixed">
        <WalkieTalkie />
      </div>
    </div>
  )
}
