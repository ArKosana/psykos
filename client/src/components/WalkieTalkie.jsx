import React, { useState, useRef, useEffect } from 'react'
import socket from '../socket'

function WalkieTalkie() {
  const [isTalking, setIsTalking] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioContextRef = useRef(null)
  const touchTimerRef = useRef(null)

  useEffect(() => {
    // Initialize media recorder
    const initMediaRecorder = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        })
        
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
        
        // Initialize audio context for playback
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
        
      } catch (error) {
        console.error('Error accessing microphone:', error)
        alert('Microphone access is required for voice chat. Please allow microphone permissions.')
      }
    }

    initMediaRecorder()

    // Set up audio playback
    const handleVoiceData = (data) => {
      playAudioData(data.data)
    }

    socket.on('voice-data', handleVoiceData)

    // Cleanup
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current)
      }
      socket.off('voice-data', handleVoiceData)
    }
  }, [])

  const playAudioData = async (arrayBuffer) => {
    try {
      if (audioContextRef.current && arrayBuffer) {
        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
        const source = audioContextRef.current.createBufferSource()
        source.buffer = audioBuffer
        source.connect(audioContextRef.current.destination)
        source.start()
      }
    } catch (error) {
      console.error('Error playing audio:', error)
    }
  }

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
    
    // Prevent long press context menu on mobile
    touchTimerRef.current = setTimeout(() => {
      // Visual feedback for long press
    }, 100)
  }

  const handleTouchEnd = (e) => {
    e.preventDefault()
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
    }
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

  const handleContextMenu = (e) => {
    e.preventDefault()
    return false
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
        onContextMenu={handleContextMenu}
        title="Hold to talk"
      >
        🎤
      </button>
      
      {isTalking && (
        <div className="talking-indicator">
          🎙️ Talking...
        </div>
      )}
    </div>
  )
}

export default WalkieTalkie
