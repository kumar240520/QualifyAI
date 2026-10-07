import { GoogleGenAI } from '@google/genai'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

const apiKey = process.env.GEMINI_API_KEY
console.log('Inspecting Gemini Live Audio with key:', apiKey ? `${apiKey.slice(0, 10)}...` : 'NONE')

const ai = new GoogleGenAI({ apiKey })

const modelsToTry = [
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-3.8-live',
]

async function testAudioStream() {
  for (const model of modelsToTry) {
    try {
      console.log(`\nConnecting to Gemini Live with model: ${model}...`)
      let chunkCount = 0
      let totalBytes = 0
      const chunkSizes = []
      const arrivalTimes = []
      let lastArrival = Date.now()
      let sampleMimeType = null

      const session = await ai.live.connect({
        model,
        config: {
          responseModalities: ['AUDIO'],
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck',
              },
            },
          },
        },
        callbacks: {
          onopen: () => {
            console.log(`[${model}] Connected! Sending client content prompt...`)
            session.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [{ text: 'Please say hello and explain what a binary search tree is in 2 sentences.' }],
                },
              ],
              turnComplete: true,
            })
          },
          onmessage: (msg) => {
            const now = Date.now()
            const parts = msg.serverContent?.modelTurn?.parts || []
            for (const part of parts) {
              if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
                chunkCount++
                sampleMimeType = part.inlineData.mimeType
                const buf = Buffer.from(part.inlineData.data, 'base64')
                totalBytes += buf.length
                chunkSizes.push(buf.length)
                arrivalTimes.push(now - lastArrival)
                lastArrival = now

                if (chunkCount <= 5 || chunkCount % 10 === 0) {
                  console.log(`Chunk #${chunkCount}: byteLength=${buf.length}, isEven=${buf.length % 2 === 0}, mimeType=${part.inlineData.mimeType}, interval=${now - lastArrival}ms`)
                }
              }
            }

            if (msg.serverContent?.turnComplete) {
              console.log(`\n=== TURN COMPLETE (${model}) ===`)
              console.log(`Total Chunks: ${chunkCount}`)
              console.log(`Total Bytes: ${totalBytes}`)
              console.log(`MIME Type: ${sampleMimeType}`)
              console.log(`Min Chunk Size: ${Math.min(...chunkSizes)} bytes`)
              console.log(`Max Chunk Size: ${Math.max(...chunkSizes)} bytes`)
              console.log(`Avg Chunk Interval: ${(arrivalTimes.reduce((a, b) => a + b, 0) / arrivalTimes.length).toFixed(1)}ms`)
              
              // In 24kHz 16-bit mono PCM:
              // 1 second = 24000 samples * 2 bytes = 48000 bytes.
              const secondsAt24k = totalBytes / 48000
              // In 16kHz 16-bit mono PCM:
              // 1 second = 16000 samples * 2 bytes = 32000 bytes.
              const secondsAt16k = totalBytes / 32000
              console.log(`Calculated Duration at 24kHz: ${secondsAt24k.toFixed(2)}s`)
              console.log(`Calculated Duration at 16kHz: ${secondsAt16k.toFixed(2)}s`)

              if (session && session.close) session.close()
              process.exit(0)
            }
          },
          onerror: (err) => {
            console.error(`[${model}] Error:`, err.message || err)
          },
          onclose: (e) => {
            console.log(`[${model}] Closed:`, e.reason || e)
          },
        },
      })

      // Wait up to 15 seconds
      await new Promise((resolve) => setTimeout(resolve, 15000))
      if (chunkCount > 0) return
    } catch (err) {
      console.warn(`[${model}] Failed:`, err.message)
    }
  }
}

testAudioStream()
