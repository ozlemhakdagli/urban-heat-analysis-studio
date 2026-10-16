import { collator, pointsToHa } from '../format.js'
import { useTranslation } from '../i18n.js'

export default function Selectors({ meta, cityCode, districtCode, amount, unit, urbanKm2, cooling, onCity, onDistrict, onAmount, onUnit, onPreset, onTargetPreset }) {
  const { t } = useTranslation()
  const provinces = meta ? [...meta.provinces].sort((a, b) => collator.compare(a.name, b.name)) : []
  const province = provinces.find((p) => p.code === cityCode)
  const districts = province ? [...province.districts].sort((a, b) => Number(b.has_data) - Number(a.has_data) || collator.compare(a.name, b.name)) : []
  const pointPreset = (points) => onPreset(String(Math.round(pointsToHa(points, urbanKm2) * 10) / 10), 'ha')

  const getReasonText = (reason) => {
    if (reason === 'small_built_up_area') return t('noResultSmallBuiltUp')
    if (reason === 'city_has_too_few_districts') return t('noResultTooFewDistricts')
    return ''
  }

  return (
    <div className="selectors">
      <div className="geo-selectors">
        <label>
          <span>{t('provinceLabel')}</span>
          <select value={cityCode || ''} disabled={!meta} onChange={(e) => onCity(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('selectProvince')}</option>
            {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </label>
        <label>
          <span>{t('districtLabel')}</span>
          <select value={districtCode || ''} disabled={!province} onChange={(e) => onDistrict(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{province ? t('selectDistrict') : t('selectProvinceFirst')}</option>
            {districts.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}{d.has_data ? '' : ` ${t('noResultPrefix', { reason: getReasonText(d.reason) })}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="amount">
        <span>{t('amountLabel')} <small>{t('minusLossHint')}</small></span>
        <div className="amount-row">
          <input type="text" inputMode="decimal" value={amount} onChange={(e) => onAmount(e.target.value)} placeholder={t('amountPlaceholder')} />
          <select value={unit} onChange={(e) => onUnit(e.target.value)} aria-label={t('unitAria')}>
            <option value="m2">{t('unitM2')}</option>
            <option value="ha">{t('unitHa')}</option>
            <option value="km2">{t('unitKm2')}</option>
          </select>
        </div>
        <div className="presets">
          <button type="button" onClick={() => onPreset(1, 'ha')}>{t('preset1ha')}</button>
          <button type="button" onClick={() => onPreset(10, 'ha')}>{t('preset10ha')}</button>
          <button type="button" disabled={!urbanKm2} title={t('pointsTooltip5')} onClick={() => pointPreset(5)}>{t('preset5pts')}</button>
          <button type="button" disabled={!urbanKm2} title={t('pointsTooltip10')} onClick={() => pointPreset(10)}>{t('preset10pts')}</button>
          {onTargetPreset && (
            <button type="button" className="target-preset-btn" title={t('targetPresetTitle', { cooling: cooling ?? 1 })} onClick={onTargetPreset}>
              {t('targetPresetLabel', { cooling: cooling ?? 1 })}
            </button>
          )}
        </div>
      </label>
    </div>
  )
}
