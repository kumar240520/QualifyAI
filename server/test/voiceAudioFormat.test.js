import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePcm16Chunk } from '../src/services/voice/voiceGateway.js'

test('validates runtime Gemini PCM format and preserves the original base64 payload', () => {
  const rawBytes = Buffer.from([0x00, 0x80, 0xff, 0x7f])
  const encoded = rawBytes.toString('base64')
  const validated = validatePcm16Chunk({ data: encoded, mimeType: 'audio/pcm;rate=24000', channels: 1, bitDepth: 16, byteOrder: 'little-endian' })
  assert.equal(validated.data, encoded)
  assert.equal(validated.sampleRate, 24000)
  assert.equal(validated.byteOrder, 'little-endian')
  assert.deepEqual(validated.diagnostics, { bytes: 4, completeFrames: 2, trailingBytes: 0, estimatedDurationSeconds: 2 / 24000 })
})

test('accepts arbitrary transport fragments only when explicitly configured and reports partial frames', () => {
  const fragment = Buffer.from([0x00, 0x80, 0x12]).toString('base64')
  const chunk = { data: fragment, mimeType: 'audio/pcm;rate=24000', channels: 1, bitDepth: 16, byteOrder: 'little-endian' }
  assert.throws(() => validatePcm16Chunk(chunk), /frame aligned/)
  const validated = validatePcm16Chunk(chunk, { allowPartialFrame: true })
  assert.equal(validated.diagnostics.bytes, 3)
  assert.equal(validated.diagnostics.completeFrames, 1)
  assert.equal(validated.diagnostics.trailingBytes, 1)
})

test('rejects PCM whose sample rate is missing from both MIME and metadata', () => {
  assert.throws(() => validatePcm16Chunk({ data: Buffer.from([0, 0]).toString('base64'), mimeType: 'audio/pcm', channels: 1, bitDepth: 16, byteOrder: 'little-endian' }), /Invalid TTS sample rate/)
})
