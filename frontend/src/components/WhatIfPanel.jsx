import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmt, signed, pct } from '../format.js'
import { useTranslation } from '../i18n.js'

const GREEN = '#2e7d32'
const BLUE = '#1565c0'

function BandBar({ min, max, minYear, maxYear, current, value, low, high, lang, t }) {
  if (min === undefined || max === undefined || min === max) return null
  const at = (v) => `${Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))}%`
  const left = at(Math.min(value, low ?? value))
  const right = at(Math.max(value, high ?? value))
  return (
    <div className="bandbar">
      <div className="band-track">
        <i className="band-range" style={{ left, right: `calc(100% - ${right})` }} />
        <i className="band-dot" style={{ left: at(value) }} title={t('bandBarDotNew', { val: fmt(value, 2, lang) })} />
        {current !== undefined && <i className="band-current" style={{ left: at(current) }} title={t('bandBarDotCurrent', { val: fmt(current, 2, lang) })} />}
      </div>
      <div className="band-labels">
        <span>{fmt(min, 1, lang)} °C <small>({minYear})</small></span>
        <span className="muted">{t('minMaxSummerLST')}</span>
        <span>{fmt(max, 1, lang)} °C <small>({maxYear})</small></span>
      </div>
    </div>
  )
}

export default function WhatIfPanel({ info, result, noResult, invalid, cooling, onCooling, onApplyTarget, loading, error, onRetry }) {
  const { lang, t } = useTranslation()

  if (noResult) {
    const msg = noResult === 'small_built_up_area'
      ? t('noResultSmallBuiltUpDesc')
      : noResult === 'city_has_too_few_districts'
      ? t('noResultTooFewDistrictsDesc')
      : t('noResultGeneric')
    return <p className="notice warn">{msg}</p>
  }
  if (loading) return <p className="empty">{t('loadingDistrict')}</p>
  if (error) return (
    <p className="notice warn">
      {t('fetchError')}
      <button type="button" onClick={onRetry}>{t('retry')}</button>
    </p>
  )
  if (!info) return <p className="empty">{t('emptySelectPrompt')}</p>
  if (invalid) return <p className="notice warn">{t('invalidAmountPrompt')}</p>
  if (!result) return <p className="empty">{t('calculating')}</p>

  const { effect, lst, applied, input, target, support, observational_reference: observed, curve } = result
  const cools = effect.value <= 0
  const negligible = Math.abs(effect.value) < 0.005
  const targetText = (value) => `${fmt(value, 1, lang)} ha`

  const actionWord = applied.hectares >= 0 ? t('headlineAdded') : t('headlineLost')
  const deltaText = `${fmt(Math.abs(effect.value), 2, lang)} °C`

  return (
    <div className="whatif">
      <div className="headline">
        <div className={`big ${cools ? 'cool' : 'heat'}`}>{signed(effect.value, 2, lang)} <small>°C</small></div>
        <div className="big-text">
          {lang === 'tr' ? (
            <>
              Model ilişkisine göre <b>{signed(applied.hectares, 1, lang).replace('+', '')} ha</b> ({signed(applied.points, 2, lang)} puan) yeşil {actionWord} ilçenin yaz yüzey sıcaklığı{' '}
              {negligible ? <b>neredeyse değişmez</b> : <>yaklaşık <b>{deltaText} {cools ? 'düşer' : 'artar'}</b></>}.
            </>
          ) : (
            <>
              Based on learned model relations, {actionWord} <b>{signed(applied.hectares, 1, lang).replace('+', '')} ha</b> ({signed(applied.points, 2, lang)} pts) of green space{' '}
              {negligible ? <b>has virtually no impact on summer land surface temperature</b> : <>{cools ? 'decreases' : 'increases'} summer land surface temperature by approximately <b>{deltaText}</b></>}.
            </>
          )}
          <div className="muted">
            {t('detailBuiltUpShare', { points: fmt(Math.abs(applied.points), 2, lang) })} ·{' '}
            {effect.has_range === false
              ? t('samplingRangeUnavailable')
              : t('samplingSensitivity', { low: signed(effect.low, 2, lang), high: signed(effect.high, 2, lang) })
            } · {t('greenShareTransition', { from: pct(result.district.green_share, 1, lang), to: pct(applied.new_green_share, 1, lang) })}
          </div>
          {observed?.kind === 'observed_association' && Number.isFinite(observed.effect_per_10pts) && (
            <div className="muted">
              {t('observedRelation', {
                early: observed.periods?.early?.[0] || '2013',
                late: observed.periods?.late?.[1] || '2025',
                effect: signed(observed.effect_per_10pts, 2, lang),
              })}
              {Number.isFinite(observed.low) && Number.isFinite(observed.high) && (
                <> ({t('observedRange', { low: signed(observed.low, 2, lang), high: signed(observed.high, 2, lang) })})</>
              )}.
            </div>
          )}
        </div>
      </div>

      {input.limited && (
        <p className="notice warn">
          {t('limitedNotice', {
            hectares: fmt(applied.hectares, 1, lang),
            maxHa: fmt(input.max_add_hectares, 0, lang),
            maxPts: fmt(input.max_add_points, 0, lang),
            lossHa: fmt(input.max_loss_points * result.district.urban_km2, 0, lang),
          })}
        </p>
      )}

      {support?.supported === false && (
        <p className="notice warn">{t('outsideSupportNotice')}</p>
      )}

      <h4>{t('bandBarTitle')}</h4>
      <BandBar
        min={info.measured.min}
        max={info.measured.max}
        minYear={info.measured.min_year}
        maxYear={info.measured.max_year}
        current={lst.current}
        value={lst.new}
        low={lst.new_low}
        high={lst.new_high}
        lang={lang}
        t={t}
      />

      <div className="target">
        <div className="target-controls">
          <label>
            {t('targetCoolingLabel')}&nbsp;
            <select value={cooling} onChange={(e) => onCooling(Number(e.target.value))}>
              {[0.5, 1, 1.5, 2].map((c) => (
                <option key={c} value={c}>{t('targetCoolingOption', { temp: fmt(c, 1, lang) })}</option>
              ))}
            </select>
          </label>
          {target.reachable && onApplyTarget && (
            <button type="button" className="target-apply-btn" onClick={onApplyTarget}>
              {t('targetApplyBtn', { ha: targetText(target.hectares) })}
            </button>
          )}
        </div>
        {target.reachable ? (
          <p>
            {t('targetNeeded', {
              cooling: fmt(target.cooling, 1, lang),
              points: fmt(Math.ceil(target.points * 10 - 1e-9) / 10, 1, lang),
              hectares: targetText(target.hectares),
            })}
            {effect.has_range !== false && Number.isFinite(target.hectares_low) && Number.isFinite(target.hectares_high) && (
              <> ({t('targetLowHighRange', { low: targetText(target.hectares_low), high: targetText(target.hectares_high) })})</>
            )}
            {target.hectares_high === null && <> ({t('targetHighUnreachable')})</>}.
          </p>
        ) : (
          <p>{t('targetUnreachable', { maxPts: fmt(input.max_add_points, 0, lang), cooling: fmt(target.cooling, 1, lang) })}</p>
        )}
      </div>

      <div className="curve-section">
        <h4>{t('curveTitle')}</h4>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={curve.map((p) => ({ ...p, band: [p.low, p.high] }))} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis
              dataKey="points"
              type="number"
              domain={[-20, 30]}
              ticks={[-20, -10, 0, 10, 20, 30]}
              label={{ value: t('curveXAxis'), position: 'insideBottom', offset: -10 }}
            />
            <YAxis unit=" °C" width={55} tickFormatter={(v) => fmt(v, 1, lang)} />
            <Tooltip
              formatter={(v) => (Array.isArray(v) ? `${fmt(v[0], 2, lang)} … ${fmt(v[1], 2, lang)}` : fmt(v, 2, lang))}
              labelFormatter={(p) => `${p > 0 ? '+' : ''}${p} ${lang === 'en' ? 'pts' : 'puan'}`}
            />
            <ReferenceLine y={0} stroke="#888" />
            <ReferenceLine
              y={-target.cooling}
              stroke={BLUE}
              strokeDasharray="4 4"
              label={{ value: t('curveRefLine', { cooling: fmt(target.cooling, 1, lang) }), position: 'insideBottomRight', fontSize: 11, fill: BLUE }}
            />
            <Area isAnimationActive={false} type="monotone" dataKey="band" name={t('curveAreaName')} stroke="none" fill={GREEN} fillOpacity={0.2} />
            <Line isAnimationActive={false} type="monotone" dataKey="effect" name={t('curveLineName')} stroke={GREEN} strokeWidth={2} dot={false} />
            <ReferenceDot x={Math.max(-20, Math.min(30, applied.points))} y={effect.value} r={6} fill={BLUE} stroke="#fff" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="fine">
        {t('whatifFine', { year: result.district.base_year })}
      </p>
    </div>
  )
}
