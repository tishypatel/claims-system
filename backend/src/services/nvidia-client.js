import OpenAI from 'openai'

let _client = null

export function getNvidiaClient() {
  if (!process.env.NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY not configured. Add it to your .env file.')
  }
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    })
  }
  return _client
}

export function getModel() {
  // meta/llama-3.1-70b-instruct: confirmed working on this NVIDIA account (0.37s response)
  // google/gemma-4-31b-it hangs indefinitely (HTTP:000 after 120s) — do not use as default
  return process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct'
}

export function getVisionModel() {
  return process.env.NVIDIA_VISION_MODEL || 'meta/llama-3.2-11b-vision-instruct'
}

// Fast model for interactive chat (low-latency)
export function getChatModel() {
  return process.env.NVIDIA_CHAT_MODEL || 'meta/llama-3.1-8b-instruct'
}

export async function chat(messages, opts = {}) {
  const client = getNvidiaClient()
  const completion = await client.chat.completions.create({
    model: opts.model || getModel(),
    messages,
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.max_tokens ?? 1024,
  })
  return completion.choices[0].message.content.trim()
}

// Strip markdown code blocks from LLM JSON output and parse
export function parseJSON(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const raw = match ? match[1] : text
  const start = raw.indexOf('{') !== -1 ? raw.indexOf('{') : raw.indexOf('[')
  const end   = raw.lastIndexOf('}') !== -1 ? raw.lastIndexOf('}') : raw.lastIndexOf(']')
  return JSON.parse(raw.slice(start, end + 1))
}
