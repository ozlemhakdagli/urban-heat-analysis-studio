// Thin wrappers around the FastAPI backend.

async function json(res) {
  if (!res.ok) {
    let detail = null
    try { detail = (await res.json()).detail } catch { /* no body */ }
    const error = new Error('request failed')
    error.status = res.status
    error.detail = detail
    throw error
  }
  return res.json()
}

export const getMeta = () => fetch('/api/meta').then(json)
export const getOverview = () => fetch('/api/geo/overview').then(json)
export const getDistrict = (code) => fetch(`/api/district/${code}`).then(json)
export const getDistrictShape = (code) => fetch(`/api/geo/district/${code}`).then(json)
export const getTopRisk = (n = 20) => fetch(`/api/top-risk?n=${n}`).then(json)
export const postWhatIf = (body, signal) =>
  fetch('/api/whatif', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }).then(json)

/**
 * Parses a single Server-Sent Events line.
 * Returns { done: true }, { token: string }, { error: string }, { model: string }, or null.
 */
export function parseSSELine(line) {
  if (!line) return null
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) return null

  const payload = trimmed.slice(5).trim()
  if (payload === '[DONE]') return { done: true }

  try {
    const data = JSON.parse(payload)
    if (data.error) return { error: data.error }
    const token = data.token ?? data.text ?? data.choices?.[0]?.delta?.content
    if (token !== undefined) {
      return data.model ? { token, model: data.model } : { token }
    }
    if (data.model) return { model: data.model }
    return null
  } catch {
    return null
  }
}

export async function streamLLMInterpretation({ district_code, amount, unit, cooling, lang = 'en' }, onChunk, signal) {
  try {
    const response = await fetch('/api/llm/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ district_code, amount, unit, cooling, lang }),
      signal,
    })

    if (!response.ok) {
      let errorDetail = lang === 'tr' ? `Sunucu hatası (${response.status})` : `Server error (${response.status})`
      try {
        const data = await response.json()
        if (data?.detail?.message) errorDetail = data.detail.message
        else if (typeof data?.detail === 'string') errorDetail = data.detail
        else if (data?.message) errorDetail = data.message
      } catch {
        // no json body
      }
      onChunk({ error: errorDetail })
      return
    }

    if (!response.body) {
      onChunk({ error: lang === 'tr' ? 'Akış gövdesi alınamadı' : 'Stream body unavailable' })
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const parsed = parseSSELine(line)
          if (parsed) {
            onChunk(parsed)
            if (parsed.done) return
          }
        }
      }
      if (buffer.trim()) {
        const parsed = parseSSELine(buffer)
        if (parsed) onChunk(parsed)
      }
      onChunk({ done: true })
    } finally {
      reader.releaseLock()
    }
  } catch (err) {
    if (signal?.aborted || err.name === 'AbortError') return
    onChunk({ error: err.message || (lang === 'tr' ? 'Bağlantı hatası' : 'Connection error') })
  }
}
