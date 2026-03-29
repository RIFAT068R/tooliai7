import { useState, useRef, useCallback, useEffect } from 'react'
import { blink } from '../blink/client'
import toast from 'react-hot-toast'

type STTStatus = 'idle' | 'recording' | 'processing' | 'error'
type TTSStatus = 'idle' | 'loading' | 'playing' | 'error'

export interface TranscribeResult {
  text: string
}

// ── Web Speech API types (not in all TS libs) ─────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition ?? window.webkitSpeechRecognition
    : null

/** Convert a Blob to base64 via FileReader */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function useVoice() {
  const [sttStatus, setSttStatus] = useState<STTStatus>('idle')
  const [isPaused, setIsPaused] = useState(false)
  const [ttsStatus, setTtsStatus] = useState<TTSStatus>('idle')
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<TranscribeResult | null>(null)
  const [interimText, setInterimText] = useState('')
  const [finalText, setFinalText] = useState('')

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const committedTextRef = useRef<string>('')
  const isPausedRef = useRef(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const warmStreamRef = useRef<MediaStream | null>(null)

  const resolveRef = useRef<((result: TranscribeResult) => void) | null>(null)
  const rejectRef = useRef<((err: Error) => void) | null>(null)
  const cancelledRef = useRef(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const isRecording = sttStatus === 'recording'
  const isProcessing = sttStatus === 'processing'
  const supportsRealtime = SpeechRecognitionAPI !== null

  useEffect(() => {
    if (supportsRealtime) return
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(s => { warmStreamRef.current = s })
      .catch(() => {})
    return () => {
      warmStreamRef.current?.getTracks().forEach(t => t.stop())
      warmStreamRef.current = null
    }
  }, [supportsRealtime])

  const startRecordingRealtime = useCallback(async () => {
    if (!SpeechRecognitionAPI) return false

    try {
      const recognition = new SpeechRecognitionAPI()
      recognitionRef.current = recognition
      committedTextRef.current = ''
      cancelledRef.current = false

      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = ''
        let newFinal = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) newFinal += transcript + ' '
          else interim += transcript
        }

        if (newFinal) {
          committedTextRef.current += newFinal
          setFinalText(committedTextRef.current)
        }
        setInterimText(interim)
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (cancelledRef.current) return
        if (event.error === 'no-speech') return
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          toast.error('Microphone access denied. Please allow mic access in your browser settings.')
          setSttStatus('error')
          setTimeout(() => setSttStatus('idle'), 2000)
        }
      }

      recognition.onend = async () => {
        if (cancelledRef.current) {
          setSttStatus('idle')
          setInterimText('')
          setFinalText('')
          return
        }

        const fullText = committedTextRef.current.trim()
        setInterimText('')

        if (!fullText) {
          setSttStatus('idle')
          setFinalText('')
          resolveRef.current?.({ text: '' })
          return
        }

        setSttStatus('processing')

        try {
          const result: TranscribeResult = { text: fullText }
          setLastResult(result)
          setFinalText('')
          setSttStatus('idle')
          resolveRef.current?.(result)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Processing failed'
          setSttStatus('error')
          setTimeout(() => setSttStatus('idle'), 2000)
          toast.error('Voice processing failed. Please try again.')
          rejectRef.current?.(new Error(msg))
        }
      }

      recognition.start()
      setSttStatus('recording')
      setInterimText('')
      setFinalText('')
      return true
    } catch {
      return false
    }
  }, [])

  const startRecordingFallback = useCallback(async () => {
    try {
      let stream = warmStreamRef.current
      if (!stream || stream.getTracks().some(t => t.readyState === 'ended')) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      warmStreamRef.current = null
      streamRef.current = stream
      audioChunksRef.current = []
      cancelledRef.current = false

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', '']
        .find(m => m === '' || MediaRecorder.isTypeSupported(m)) ?? ''

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        if (cancelledRef.current) {
          setSttStatus('idle')
          return
        }
        setSttStatus('processing')

        navigator.mediaDevices?.getUserMedia({ audio: true })
          .then(s => { warmStreamRef.current = s })
          .catch(() => {})

        try {
          const chunks = audioChunksRef.current
          if (!chunks.length) throw new Error('No audio recorded')

          const audioBlob = new Blob(chunks, { type: mimeType || 'audio/webm' })
          const base64 = await blobToBase64(audioBlob)

          const { text: original } = await blink.ai.transcribeAudio({
            audio: base64,
            model: 'fal-ai/wizper',
          })

          if (!original?.trim()) throw new Error('No speech detected')

          const result: TranscribeResult = { text: original }
          setLastResult(result)
          setSttStatus('idle')
          resolveRef.current?.(result)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Transcription failed'
          const isAuth = msg.includes('401') || msg.toLowerCase().includes('unauthorized')
          setSttStatus('error')
          setTimeout(() => setSttStatus('idle'), 2000)
          if (isAuth) {
            toast.error('Please sign in to use voice input.')
          } else if (!msg.includes('No speech')) {
            toast.error('Voice transcription failed. Please try again.')
          }
          rejectRef.current?.(new Error(msg))
        }
      }

      mediaRecorder.start(250)
      setSttStatus('recording')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
        toast.error('Microphone access denied. Please allow mic access in your browser settings.')
      } else {
        toast.error('Could not start recording. Please check your microphone.')
      }
      setSttStatus('error')
      setTimeout(() => setSttStatus('idle'), 2000)
    }
  }, [])

  const startRecording = useCallback(async () => {
    setIsPaused(false)
    isPausedRef.current = false
    const ok = await startRecordingRealtime()
    if (!ok) await startRecordingFallback()
  }, [startRecordingRealtime, startRecordingFallback])

  const pauseRecording = useCallback(() => {
    if (!isRecording || isPaused) return

    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
    }
    setIsPaused(true)
    isPausedRef.current = true
  }, [isRecording, isPaused])

  const resumeRecording = useCallback(async () => {
    if (!isRecording || !isPaused) return

    if (SpeechRecognitionAPI) {
      try {
        const recognition = new SpeechRecognitionAPI()
        recognitionRef.current = recognition
        recognition.continuous = true
        recognition.interimResults = true
        recognition.maxAlternatives = 1

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interim = ''
          let newFinal = ''
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) newFinal += transcript + ' '
            else interim += transcript
          }
          if (newFinal) {
            committedTextRef.current += newFinal
            setFinalText(committedTextRef.current)
          }
          setInterimText(interim)
        }

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (cancelledRef.current) return
          if (event.error === 'no-speech') return
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            toast.error('Microphone access denied.')
            setSttStatus('error')
            setTimeout(() => setSttStatus('idle'), 2000)
          }
        }

        recognition.onend = async () => {
          if (cancelledRef.current || isPausedRef.current) return
          const fullText = committedTextRef.current.trim()
          setInterimText('')
          if (!fullText) {
            setSttStatus('idle')
            setFinalText('')
            resolveRef.current?.({ text: '' })
            return
          }
          setSttStatus('processing')
          try {
            const result: TranscribeResult = { text: fullText }
            setLastResult(result)
            setFinalText('')
            setSttStatus('idle')
            resolveRef.current?.(result)
          } catch {
            setSttStatus('error')
            setTimeout(() => setSttStatus('idle'), 2000)
            toast.error('Voice processing failed. Please try again.')
          }
        }

        recognition.start()
      } catch {}
    } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
    }
    setIsPaused(false)
    isPausedRef.current = false
  }, [isRecording, isPaused])

  const stopRecording = useCallback((): Promise<TranscribeResult> => {
    return new Promise((resolve, reject) => {
      resolveRef.current = resolve
      rejectRef.current = reject
      cancelledRef.current = false
      setIsPaused(false)
      isPausedRef.current = false

      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      } else {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop()
        } else {
          setSttStatus('idle')
          reject(new Error('No active recording'))
          return
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop())
          streamRef.current = null
        }
      }
    })
  }, [])

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true
    resolveRef.current = null
    rejectRef.current = null
    setIsPaused(false)
    isPausedRef.current = false

    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setSttStatus('idle')
    setInterimText('')
    setFinalText('')
  }, [])

  // ── TTS ────────────────────────────────────────────────────────────────
  const speak = useCallback(async (text: string, messageId: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setSpeakingMessageId(messageId)
    setTtsStatus('loading')

    try {
      const { url } = await blink.ai.generateSpeech({ text: text.slice(0, 4000), voice: 'nova' })
      const audioEl = new Audio(url)
      audioRef.current = audioEl
      audioEl.onplay = () => setTtsStatus('playing')
      audioEl.onended = () => { setTtsStatus('idle'); setSpeakingMessageId(null) }
      audioEl.onerror = () => {
        setTtsStatus('error')
        setSpeakingMessageId(null)
        setTimeout(() => setTtsStatus('idle'), 2000)
      }
      await audioEl.play()
    } catch {
      setTtsStatus('error')
      setSpeakingMessageId(null)
      setTimeout(() => setTtsStatus('idle'), 2000)
    }
  }, [])

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setTtsStatus('idle')
    setSpeakingMessageId(null)
  }, [])

  return {
    sttStatus,
    isRecording,
    isPaused,
    isProcessing,
    interimText,
    finalText,
    lastResult,
    supportsRealtime,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    ttsStatus,
    speakingMessageId,
    speak,
    stopSpeaking,
  }
}