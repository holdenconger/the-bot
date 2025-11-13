import { useEffect, useState } from 'react'

export interface SpeechVoice {
  name: string
  voiceURI: string
  lang: string
  default: boolean
}

export const useSpeechVoices = () => {
  const [voices, setVoices] = useState<SpeechVoice[]>([])
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => {
    if (!supported) return

    const synth = window.speechSynthesis

    const updateVoices = () => {
      const available = synth.getVoices()
      if (!available.length) return
      setVoices(
        available.map((voice) => ({
          name: voice.name,
          voiceURI: voice.voiceURI,
          lang: voice.lang,
          default: voice.default,
        })),
      )
    }

    updateVoices()
    synth.addEventListener('voiceschanged', updateVoices)

    return () => {
      synth.removeEventListener('voiceschanged', updateVoices)
    }
  }, [supported])

  return { voices, supported }
}
