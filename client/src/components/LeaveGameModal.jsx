import React from 'react'

function LeaveGameModal({ isOpen, onClose, onLeaveToLobby, onLeaveToHome }) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Leave Game?</h3>
        <p>
          You can return to the lobby or exit to the main menu.
          If you're the host, another player will become host.
        </p>
        
        <div className="modal-actions">
          <button 
            onClick={onLeaveToLobby}
            className="btn btn-secondary"
          >
            Return to Lobby
          </button>
          
          <button 
            onClick={onLeaveToHome}
            className="btn btn-leave"
          >
            Exit to Menu
          </button>
          
          <button 
            onClick={onClose}
            className="btn"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default LeaveGameModal
