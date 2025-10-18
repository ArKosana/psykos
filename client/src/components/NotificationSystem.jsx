import React, { useState, useEffect } from 'react'

function NotificationSystem() {
  const [notifications, setNotifications] = useState([])
  const [showPanel, setShowPanel] = useState(false)

  useEffect(() => {
    const handlePlayerLeft = (data) => {
      addNotification(`${data.playerName} left the game`, 'info')
    }

    const handlePlayerJoined = (data) => {
      addNotification(`${data.playerName} joined the game`, 'info')
    }

    const handleHostTransferred = (data) => {
      addNotification(`${data.newHost.name} is now the host`, 'warning')
    }

    const handleGameError = (data) => {
      addNotification(data.message, 'error')
    }

    const handleAIGenerating = (data) => {
      addNotification(data.message, 'info')
    }

    // Listen for notification events
    window.addEventListener('player-left', (event) => {
      handlePlayerLeft(event.detail)
    })

    window.addEventListener('player-joined', (event) => {
      handlePlayerJoined(event.detail)
    })

    window.addEventListener('host-transferred', (event) => {
      handleHostTransferred(event.detail)
    })

    window.addEventListener('game-error', (event) => {
      handleGameError(event.detail)
    })

    window.addEventListener('ai-generating', (event) => {
      handleAIGenerating(event.detail)
    })

    return () => {
      window.removeEventListener('player-left', handlePlayerLeft)
      window.removeEventListener('player-joined', handlePlayerJoined)
      window.removeEventListener('host-transferred', handleHostTransferred)
      window.removeEventListener('game-error', handleGameError)
      window.removeEventListener('ai-generating', handleAIGenerating)
    }
  }, [])

  const addNotification = (message, type = 'info') => {
    const id = Date.now() + Math.random()
    const notification = { id, message, type, timestamp: Date.now() }
    
    setNotifications(prev => [notification, ...prev.slice(0, 4)]) // Keep only 5 latest
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 5000)
  }

  const clearNotifications = () => {
    setNotifications([])
  }

  const getNotificationColor = (type) => {
    switch (type) {
      case 'error': return '#ff4444'
      case 'warning': return '#ffaa00'
      case 'success': return '#00ff88'
      default: return '#0088ff'
    }
  }

  return (
    <>
      {/* Notification Badge */}
      {notifications.length > 0 && (
        <div 
          className="notification-badge"
          onClick={() => setShowPanel(!showPanel)}
          title={`${notifications.length} notifications`}
        >
          {notifications.length}
        </div>
      )}

      {/* Notifications Panel */}
      {showPanel && (
        <div className="notifications-panel">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text)' }}>
              Notifications
            </span>
            <button 
              onClick={clearNotifications}
              className="btn btn-compact"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
            >
              Clear
            </button>
          </div>
          
          {notifications.map((notification) => (
            <div 
              key={notification.id}
              className="notification"
              style={{ borderLeftColor: getNotificationColor(notification.type) }}
            >
              <div style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                {notification.message}
              </div>
              <div style={{ 
                fontSize: '0.7rem', 
                color: 'var(--text-muted)', 
                marginTop: '0.25rem',
                textAlign: 'right'
              }}>
                {new Date(notification.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// Helper function to dispatch notification events
export const notify = (message, type = 'info') => {
  const event = new CustomEvent(`game-${type}`, { detail: { message } })
  window.dispatchEvent(event)
}

export const notifyPlayerLeft = (playerName) => {
  const event = new CustomEvent('player-left', { detail: { playerName } })
  window.dispatchEvent(event)
}

export const notifyPlayerJoined = (playerName) => {
  const event = new CustomEvent('player-joined', { detail: { playerName } })
  window.dispatchEvent(event)
}

export const notifyHostTransferred = (newHost) => {
  const event = new CustomEvent('host-transferred', { detail: { newHost } })
  window.dispatchEvent(event)
}

export default NotificationSystem
