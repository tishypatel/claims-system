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
  // openai/gpt-oss-120b: reasoning model, confirmed working (~2s, native 0-100 JSON outputs)
  return process.env.NVIDIA_MODEL || 'openai/gpt-oss-120b'
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
    // 2048 default: gpt-oss-120b is a reasoning model — it uses extra tokens internally
    // before producing the final answer, so 1024 can cut off mid-response
    max_tokens: opts.max_tokens ?? 2048,
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
