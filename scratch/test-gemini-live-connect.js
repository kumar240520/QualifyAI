import { GoogleGenAI } from '../server/node_modules/@google/genai/dist/index.js'
import dotenv from 'dotenv'

dotenv.config({ path: 'server/.env' })

const apiKey = process.env.GEMINI_API_KEY
console.log('Testing Gemini Live with key:', apiKey ? `${apiKey.slice(0, 10)}...` : 'NONE')

const ai = new GoogleGenAI({ apiKey })

const modelsToTry = [
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
]

async function testLive() {
  for (const model of modelsToTry) {
    try {
      console.log(`\nAttempting Live connect with model: ${model}...`)
      let sessionOpened = false
      let setupDone = false

      const session = await ai.live.connect({
        model,
        config: {
          responseModalities: ['AUDIO'],
        },
        callbacks: {
          onopen: () => {
            console.log(`[${model}] WebSocket connected!`);
            sessionOpened = true;
          },
          onmessage: (msg) => {
            console.log(`[${model}] Message received:`, Object.keys(msg));
            setupDone = true;
          },
          onerror: (err) => {
            console.error(`[${model}] Error:`, err.message || err);
          },
          onclose: (e) => {
            console.log(`[${model}] Closed:`, e.reason || e);
          },
        },
      })

      console.log(`[${model}] Session created successfully!`);
      // Close session
      if (session && session.close) {
        session.close();
      }
      return model;
    } catch (err) {
      console.error(`[${model}] Connect failed:`, err.message);
    }
  }
}

testLive().then((model) => {
  console.log('\nSupported Live Model:', model);
  process.exit(0);
}).catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
})
