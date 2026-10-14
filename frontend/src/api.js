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
