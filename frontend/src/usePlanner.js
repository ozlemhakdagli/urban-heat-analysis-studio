import { useEffect, useMemo, useRef, useState } from 'react'
import { getDistrict, getMeta, getOverview, getTopRisk, postWhatIf } from './api.js'
import { parseAmount } from './format.js'

export function buildLookup(meta) {
  const byDistrict = new Map()
  const cityBounds = new Map()
  if (meta) {
    for (const p of meta.provinces) {
      let b = null
      for (const d of p.districts) {
        byDistrict.set(d.code, { ...d, cityCode: p.code })
        b = b
          ? [Math.min(b[0], d.bounds[0]), Math.min(b[1], d.bounds[1]), Math.max(b[2], d.bounds[2]), Math.max(b[3], d.bounds[3])]
          : [...d.bounds]
      }
      cityBounds.set(p.code, b)
    }
  }
  return { byDistrict, cityBounds }
}

export function findDefaultDistrict(meta) {
  if (!meta || !meta.provinces) return null
  // Check for Kadıköy (2053) first
  for (const p of meta.provinces) {
    for (const d of p.districts) {
      if (d.code === 2053 && d.has_data) return { cityCode: p.code, districtCode: d.code }
    }
  }
  // Fallback to first district with data
  for (const p of meta.provinces) {
    for (const d of p.districts) {
      if (d.has_data) return { cityCode: p.code, districtCode: d.code }
    }
  }
  return null
}

export function computeTargetPreset(hectares) {
  if (hectares === null || hectares === undefined || !Number.isFinite(hectares)) return null
  return String(Math.ceil(hectares * 10 - 1e-9) / 10)
}

export default function usePlanner() {
  const [meta, setMeta] = useState(null)
  const [overview, setOverview] = useState(null)
  const [topRisk, setTopRisk] = useState([])
  const [cityCode, setCityCode] = useState(null)
  const [districtCode, setDistrictCode] = useState(null)
  const [info, setInfo] = useState(null)
  const [noResult, setNoResult] = useState(null)
  const [amount, setAmount] = useState('10000')
  const [unit, setUnit] = useState('m2')
  const [cooling, setCooling] = useState(1)
  const [result, setResult] = useState(null)
  const [tab, setTab] = useState('whatif')
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [infoError, setInfoError] = useState(false)
  const [whatIfError, setWhatIfError] = useState(false)

  const retryAll = () => setRetry((r) => r + 1)

  useEffect(() => {
    setFailed(false)
    getMeta().then((m) => {
      setMeta(m)
      const def = findDefaultDistrict(m)
      if (def) {
        setCityCode(def.cityCode)
        setDistrictCode(def.districtCode)
      }
    }).catch(() => setFailed(true))
    getOverview().then(setOverview).catch(() => setFailed(true))
    getTopRisk(20).then(setTopRisk).catch(() => {})
  }, [retry])

  const lookup = useMemo(() => buildLookup(meta), [meta])

  const selectCity = (code) => {
    setCityCode(code)
    setDistrictCode(null)
  }

  const selectDistrict = (code, nextTab) => {
    setDistrictCode(code)
    const d = lookup.byDistrict.get(code)
    if (d) setCityCode(d.cityCode)
    if (nextTab) setTab(nextTab)
  }

  // Load district details
  useEffect(() => {
    setInfo(null); setResult(null); setNoResult(null); setInfoError(false)
    if (!districtCode) return
    let alive = true
    getDistrict(districtCode)
      .then((d) => alive && setInfo(d))
      .catch((e) => {
        if (!alive) return
        const reason = e.detail && e.detail.reason
        if (reason) setNoResult(reason)
        else setInfoError(true)
      })
    return () => { alive = false }
  }, [districtCode, retry])

  // Recalculate what-if
  const value = parseAmount(amount)
  const invalid = !Number.isFinite(value)
  const abort = useRef(null)

  useEffect(() => {
    if (!info || invalid) return
    let alive = true
    setWhatIfError(false)
    const timer = setTimeout(() => {
      abort.current?.abort()
      abort.current = new AbortController()
      postWhatIf({ district_code: info.code, amount: value, unit, cooling }, abort.current.signal)
        .then((r) => { if (alive) { setResult(r); setWhatIfError(false) } })
        .catch((e) => {
          if (!alive || e.name === 'AbortError') return
          setResult(null)
          setWhatIfError(true)
        })
    }, 250)
    return () => { alive = false; clearTimeout(timer); abort.current?.abort() }
  }, [info, value, invalid, unit, cooling, retry])

  const applyPreset = (val, nextUnit) => {
    setUnit(nextUnit)
    setAmount(String(val))
  }

  const applyTargetCooling = () => {
    if (result?.target?.reachable && result.target.hectares) {
      const preset = computeTargetPreset(result.target.hectares)
      if (preset) {
        setUnit('ha')
        setAmount(preset)
      }
    }
  }

  const bounds = districtCode ? lookup.byDistrict.get(districtCode)?.bounds : cityCode ? lookup.cityBounds.get(cityCode) : null
  const loadingInfo = !!districtCode && !info && !noResult && !infoError

  return {
    state: {
      meta,
      overview,
      topRisk,
      cityCode,
      districtCode,
      info,
      noResult,
      amount,
      unit,
      cooling,
      result,
      tab,
      failed,
      infoError,
      whatIfError,
      invalid,
      loadingInfo,
      bounds,
    },
    actions: {
      selectCity,
      selectDistrict,
      setAmount,
      setUnit,
      setCooling,
      setTab,
      retryAll,
      applyPreset,
      applyTargetCooling,
    },
    lookup,
  }
}
