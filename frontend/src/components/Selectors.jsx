import { collator, pointsToHa } from '../format.js'

const REASONS = { small_built_up_area: 'yapılaşmış alan çok küçük', city_has_too_few_districts: 'ilde yeterli ilçe yok' }

export default function Selectors({ meta, cityCode, districtCode, amount, unit, urbanKm2, cooling, onCity, onDistrict, onAmount, onUnit, onPreset, onTargetPreset }) {
  const provinces = meta ? [...meta.provinces].sort((a, b) => collator.compare(a.name, b.name)) : []
  const province = provinces.find((p) => p.code === cityCode)
  const districts = province ? [...province.districts].sort((a, b) => Number(b.has_data) - Number(a.has_data) || collator.compare(a.name, b.name)) : []
  const pointPreset = (points) => onPreset(String(Math.round(pointsToHa(points, urbanKm2) * 10) / 10), 'ha')

  return (
    <div className="selectors">
      <div className="geo-selectors">
        <label>
          <span>İl</span>
          <select value={cityCode || ''} disabled={!meta} onChange={(e) => onCity(e.target.value ? Number(e.target.value) : null)}>
            <option value="">İl seçin…</option>
            {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </label>
        <label>
          <span>İlçe</span>
          <select value={districtCode || ''} disabled={!province} onChange={(e) => onDistrict(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{province ? 'İlçe seçin…' : 'Önce il seçin'}</option>
            {districts.map((d) => (
              <option key={d.code} value={d.code}>{d.name}{d.has_data ? '' : ` (sonuç yok: ${REASONS[d.reason] || ''})`}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="amount">
        <span>Eklenecek yeşil alan <small>(eksi = yeşil kaybı)</small></span>
        <div className="amount-row">
          <input type="text" inputMode="decimal" value={amount} onChange={(e) => onAmount(e.target.value)} placeholder="örn. 10000" />
          <select value={unit} onChange={(e) => onUnit(e.target.value)} aria-label="Birim">
            <option value="m2">m²</option>
            <option value="ha">hektar</option>
            <option value="km2">km²</option>
          </select>
        </div>
        <div className="presets">
          <button type="button" onClick={() => onPreset(1, 'ha')}>1 ha</button>
          <button type="button" onClick={() => onPreset(10, 'ha')}>10 ha</button>
          <button type="button" disabled={!urbanKm2} title="Yapılaşmış alanın %5’i kadar yeşil" onClick={() => pointPreset(5)}>+5 puan</button>
          <button type="button" disabled={!urbanKm2} title="Yapılaşmış alanın %10’u kadar yeşil" onClick={() => pointPreset(10)}>+10 puan</button>
          {onTargetPreset && (
            <button type="button" className="target-preset-btn" title={`−${cooling ?? 1} °C serinleme için gereken alanı uygula`} onClick={onTargetPreset}>
              🎯 Hedef −{cooling ?? 1} °C
            </button>
          )}
        </div>
      </label>
    </div>
  )
}
