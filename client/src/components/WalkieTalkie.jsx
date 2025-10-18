import React, { useState, useRef, useEffect } from 'react'
import { socket } from '../socket'

function WalkieTalkie() {
  const [isTalking, setIsTalking] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  useEffect(() => {
    // Initialize media recorder
    const initMediaRecorder = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        })
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data)
          }
        }
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' })
          sendAudioData(audioBlob)
          audioChunksRef.current = []
        }
        
        mediaRecorderRef.current = mediaRecorder
      } catch (error) {
        console.error('Error accessing microphone:', error)
      }
    }

    initMediaRecorder()

    // Cleanup
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const sendAudioData = (audioBlob) => {
    const reader = new FileReader()
    reader.onload = () => {
      const arrayBuffer = reader.result
      socket.emit('voice-data', arrayBuffer)
    }
    reader.readAsArrayBuffer(audioBlob)
  }

  const startTalking = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
      setIsTalking(true)
      setIsRecording(true)
      audioChunksRef.current = []
      
      socket.emit('voice-start')
      mediaRecorderRef.current.start(100) // Collect data every 100ms
    }
  }

  const stopTalking = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setIsTalking(false)
      mediaRecorderRef.current.stop()
      socket.emit('voice-end')
      
      // Small delay to ensure recording stops completely
      setTimeout(() => {
        setIsRecording(false)
      }, 100)
    }
  }

  const handleTouchStart = (e) => {
    e.preventDefault()
    startTalking()
  }

  const handleTouchEnd = (e) => {
    e.preventDefault()
    stopTalking()
  }

  const handleMouseDown = (e) => {
    e.preventDefault()
    startTalking()
  }

  const handleMouseUp = (e) => {
    e.preventDefault()
    stopTalking()
  }

  const handleMouseLeave = (e) => {
    if (isTalking) {
      stopTalking()
    }
  }

  return (
    <div className="walkie-talkie-container">
      <button
        className={`walkie-talkie-btn ${isTalking ? 'talking' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        title="Hold to talk"
      >
        🎤
      </button>
      
      {isTalking && (
        <div style={{
          position: 'absolute',
          top: '-30px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--surface)',
          color: 'var(--primary)',
          padding: '0.25rem 0.75rem',
          borderRadius: '12px',
          fontSize: '0.7rem',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          border: '1px solid var(--border-light)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
        }}>
          🎙️ Talking...
        </div>
      )}
    </div>
  )
}

export default WalkieTalkie
