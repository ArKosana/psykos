import React, { useEffect, useRef, useState } from 'react'
import socket from '../socket'

/**
 * WalkieTalkie
 * - Press & hold to talk (touch or mouse)
 * - Toggle "Lock" to latch talking on/off
 * - Shows connection & mic states
 * NOTE: Server simply relays voice events. We send small PCM chunks.
 */
export default function WalkieTalkie() {
  const [ready, setReady] = useState(false)
  const [recording, setRecording] = useState(false)
  const [locked, setLocked] = useState(false)
  const mediaStreamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const processorRef = useRef(null)

  useEffect(() => {
    // Pre-warm permission on first user gesture only
    const enable = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        mediaStreamRef.current = stream
        setReady(true)
      } catch (e) {
        console.warn('Mic permission denied:', e)
        setReady(false)
      }
    }

    const onFirstTap = () => {
      window.removeEventListener('touchstart', onFirstTap)
      window.removeEventListener('mousedown', onFirstTap)
      enable()
    }
    window.addEventListener('touchstart', onFirstTap, { passive: true })
    window.addEventListener('mousedown', onFirstTap)

    return () => {
      window.removeEventListener('touchstart', onFirstTap)
      window.removeEventListener('mousedown', onFirstTap)
      stopCapture()
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop())
        mediaStreamRef.current = null
      }
    }
  }, [])

  const startCapture = async () => {
    if (!mediaStreamRef.current) {
      try {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      } catch (e) {
        alert('Microphone permission is required.')
        return
      }
    }
    if (recording) return

    // AudioContext + ScriptProcessor (works on mobile Safari/Chrome)
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' })
    const source = audioCtx.createMediaStreamSource(mediaStreamRef.current)
    const processor = audioCtx.createScriptProcessor(2048, 1, 1)

    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0)
      // Convert Float32 [-1,1] -> Int16
      const buffer = new ArrayBuffer(input.length * 2)
      const view = new DataView(buffer)
      for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]))
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      }
      socket.emit('voice-data', buffer)
    }

    source.connect(processor)
    processor.connect(audioCtx.destination)

    audioCtxRef.current = audioCtx
    processorRef.current = processor
    setRecording(true)
    socket.emit('voice-start')
  }

  const stopCapture = () => {
    if (processorRef.current) {
      try {
        processorRef.current.disconnect()
      } catch {}
      processorRef.current = null
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close()
      } catch {}
      audioCtxRef.current = null
    }
    if (recording) {
      socket.emit('voice-end')
      setRecording(false)
    }
  }

  // Press & Hold handlers
  const onPressStart = () => {
    if (!locked) startCapture()
  }
  const onPressEnd = () => {
    if (!locked) stopCapture()
  }
  const toggleLock = () => {
    const next = !locked
    setLocked(next)
    if (next && !recording) startCapture()
    if (!next && recording) stopCapture()
  }

  // Basic incoming audio (optional — simple preview so people hear others)
  useEffect(() => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    let sourceNode = null
    let playing = false
    const pcmQueue = []
    let scriptNode = null

    const play = () => {
      if (playing) return
      playing = true
      scriptNode = audioCtx.createScriptProcessor(2048, 1, 1)
      scriptNode.onaudioprocess = (e) => {
        const out = e.outputBuffer.getChannelData(0)
        if (pcmQueue.length) {
          const data = new Int16Array(pcmQueue.shift())
          for (let i = 0; i < out.length; i++) {
            out[i] = (i < data.length ? data[i] / 0x7fff : 0)
          }
        } else {
          out.fill(0)
        }
      }
      scriptNode.connect(audioCtx.destination)
    }

    const onStart = () => { play() }
    const onData = ({ data }) => { pcmQueue.push(data) }
    const onEnd = () => { /* keep alive */ }

    socket.on('voice-start', onStart)
    socket.on('voice-data', onData)
    socket.on('voice-end', onEnd)

    return () => {
      socket.off('voice-start', onStart)
      socket.off('voice-data', onData)
      socket.off('voice-end', onEnd)
      if (scriptNode) try { scriptNode.disconnect() } catch {}
      try { audioCtx.close() } catch {}
    }
  }, [])

  return (
    <div 
      className="ptt"
      onMouseDown={onPressStart}
      onMouseUp={onPressEnd}
      onMouseLeave={onPressEnd}
      onTouchStart={onPressStart}
      onTouchEnd={onPressEnd}
    >
      <div className={`ptt-indicator ${recording ? 'on' : ''}`}/>
      <button className={`ptt-btn ${recording ? 'speaking' : ''}`} disabled={!ready}>
        {recording ? 'TALKING…' : 'HOLD TO TALK'}
      </button>
      <button className={`ptt-lock ${locked ? 'active' : ''}`} onClick={toggleLock} disabled={!ready}>
        {locked ? 'UNLOCK' : 'LOCK'}
      </button>
    </div>
  )
}
