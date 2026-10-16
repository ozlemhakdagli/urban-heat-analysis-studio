import { useCallback, useEffect, useRef, useState } from 'react'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import { getDistrictShape } from '../api.js'
import { riskColor } from '../format.js'
import { useTranslation } from '../i18n.js'

const TURKEY = [25.6, 35.8, 44.9, 42.2] // west, south, east, north

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    const [west, south, east, north] = bounds || TURKEY
    map.fitBounds([[south, west], [north, east]], { padding: [24, 24], maxZoom: 12 })
  }, [map, bounds])
  return null
}

function AutoResize() {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    if (!container || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      map.invalidateSize()
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [map])
  return null
}

// the tile layer needs internet; the choice is remembered between visits
const readTiles = () => { try { return localStorage.getItem('ugp.tiles') !== 'off' } catch { return true } }
const writeTiles = (on) => { try { localStorage.setItem('ugp.tiles', on ? 'on' : 'off') } catch { /* private mode */ } }

export default function MapView({ overview, selectedCity, selectedDistrict, bounds, onPick, onReset, overviewFailed }) {
  const { t } = useTranslation()
  const [shape, setShape] = useState(null)
  const [tiles, setTiles] = useState(readTiles)
  const pick = useRef(onPick)
  pick.current = onPick

  useEffect(() => {
    setShape(null)
    if (!selectedDistrict) return
    let alive = true
    getDistrictShape(selectedDistrict).then((s) => alive && setShape(s)).catch(() => {})
    return () => { alive = false }
  }, [selectedDistrict])

  const toggleTiles = () => setTiles((on) => { writeTiles(!on); return !on })

  // The colour of a district is its risk score; grey districts have no result. The selected province stays strong, the rest fades.
  const styleFor = useCallback((feature) => {
    const p = feature.properties
    const inCity = !selectedCity || p.city_code === selectedCity
    return {
      fillColor: p.has_data ? riskColor(p.risk_score) : '#d9d9d9',
      fillOpacity: inCity ? 0.8 : 0.3,
      color: inCity && selectedCity ? '#4a4a4a' : '#ffffff',
      weight: inCity && selectedCity ? 0.9 : 0.4,
      smoothFactor: 0,
    }
  }, [selectedCity])

  const onEachFeature = useCallback((feature, layer) => {
    const p = feature.properties
    layer.bindTooltip(`${p.district_name} · ${p.city_name}${p.has_data ? ` · ${t('riskLabel').toLowerCase()} ${p.risk_score}` : ` · ${t('noResultLegend')}`}`, { sticky: true })
    layer.on('click', () => pick.current(p.district_code))
  }, [t])

  return (
    <div className="map-wrap">
      <MapContainer bounds={[[TURKEY[1], TURKEY[0]], [TURKEY[3], TURKEY[2]]]} preferCanvas className="map" scrollWheelZoom>
        {tiles && <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" opacity={0.55} />}
        {overview && <GeoJSON key={selectedCity || 'all'} data={overview} style={styleFor} onEachFeature={onEachFeature} smoothFactor={0} />}
        {shape && <GeoJSON key={selectedDistrict} data={shape} interactive={false} style={{ color: '#1b5e20', weight: 3, fill: false, smoothFactor: 0 }} smoothFactor={0} />}
        <FitBounds bounds={bounds} />
        <AutoResize />
      </MapContainer>
      {!overview && <div className="map-loading">{overviewFailed ? t('mapLoadError') : t('mapLoading')}</div>}
      <div className="map-actions">
        <button type="button" onClick={toggleTiles} title={t('tilesTooltip')}>
          {tiles ? t('hideTiles') : t('showTiles')}
        </button>
        {(selectedCity || selectedDistrict) && <button type="button" onClick={onReset}>{t('resetTurkey')}</button>}
      </div>
      <div className="legend">
        <span>{t('riskLabel')}</span>
        <div className="legend-bar" />
        <span>{t('lowToHigh')}</span>
        <i className="legend-none" /> <span>{t('noResultLegend')}</span>
      </div>
    </div>
  )
}
