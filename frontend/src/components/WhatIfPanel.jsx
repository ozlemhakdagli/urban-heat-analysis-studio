import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmt, signed, pct } from '../format.js'

const GREEN = '#2e7d32'
const BLUE = '#1565c0'

const NO_RESULT = {
  small_built_up_area: 'Bu ilçenin yapılaşmış alanı 0,5 km²’den küçük. Bu kadar küçük bir alanda yüzey sıcaklığı güvenilir ölçülemediği için sonuç üretilmiyor.',
  city_has_too_few_districts: 'Bu ilde, ilçeleri şehir içinde karşılaştırmak için yeterli sayıda (en az 3) güvenilir ilçe yok; sonuç üretilmiyor.',
}

function BandBar({ min, max, minYear, maxYear, current, value, low, high }) {
  if (min === undefined || max === undefined || min === max) return null
  const at = (v) => `${Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))}%`
  const left = at(Math.min(value, low ?? value))
  const right = at(Math.max(value, high ?? value))
  return (
    <div className="bandbar">
      <div className="band-track">
        <i className="band-range" style={{ left, right: `calc(100% - ${right})` }} />
        <i className="band-dot" style={{ left: at(value) }} title={`Yeni: ${fmt(value, 2)} °C`} />
        {current !== undefined && <i className="band-current" style={{ left: at(current) }} title={`Mevcut: ${fmt(current, 2)} °C`} />}
      </div>
      <div className="band-labels">
        <span>{fmt(min, 1)} °C <small>({minYear})</small></span>
        <span className="muted">ilçenin en düşük / en yüksek yaz ortalaması</span>
        <span>{fmt(max, 1)} °C <small>({maxYear})</small></span>
      </div>
    </div>
  )
}

export default function WhatIfPanel({ info, result, noResult, invalid, cooling, onCooling, onApplyTarget, loading, error, onRetry }) {
  if (noResult) return <p className="notice warn">{NO_RESULT[noResult] || 'Bu ilçe için sonuç yok.'}</p>
  if (loading) return <p className="empty">İlçe verisi yükleniyor…</p>
  if (error) return (
    <p className="notice warn">
      Veri alınamadı (sunucuya ulaşılamadı).
      <button type="button" onClick={onRetry}>Yeniden dene</button>
    </p>
  )
  if (!info) return <p className="empty">Haritadan bir ilçeye tıklayın ya da yukarıdan il ve ilçe seçin; sonra eklemek istediğiniz yeşil alanı yazın.</p>
  if (invalid) return <p className="notice warn">Eklenecek yeşil alan için bir sayı yazın (örn. 10000).</p>
  if (!result) return <p className="empty">Hesaplanıyor…</p>

  const { effect, lst, applied, input, target, support, observational_reference: observed, curve } = result
  const cools = effect.value <= 0
  const negligible = Math.abs(effect.value) < 0.005
  const targetText = (value) => `${fmt(value, 1)} ha`

  return (
    <div className="whatif">
      <div className="headline">
        <div className={`big ${cools ? 'cool' : 'heat'}`}>{signed(effect.value, 2)} <small>°C</small></div>
        <div className="big-text">
          Model ilişkisine göre <b>{signed(applied.hectares, 1).replace('+', '')} ha</b> ({signed(applied.points, 2)} puan) yeşil {applied.hectares >= 0 ? 'eklenirse' : 'kaybedilirse'} ilçenin yaz yüzey sıcaklığı{' '}
          {negligible ? <b>neredeyse değişmez</b> : <>yaklaşık <b>{fmt(Math.abs(effect.value), 2)} °C {cools ? 'düşer' : 'artar'}</b></>}.
          <div className="muted">Yapılaşmış alanın %{fmt(Math.abs(applied.points), 2)}’i kadar yeşil · {effect.has_range === false ? 'örnekleme aralığı mevcut değil' : <>duyarlılık aralığı: {signed(effect.low, 2)} … {signed(effect.high, 2)} °C</>} · yeşil pay {pct(result.district.green_share)} → {pct(applied.new_green_share)}</div>
          {observed?.kind === 'observed_association' && Number.isFinite(observed.effect_per_10pts) && (
            <div className="muted">
              Ayrı tarihsel ilişki{Array.isArray(observed.periods?.early) && Array.isArray(observed.periods?.late) && <> ({observed.periods.early.join('–')} → {observed.periods.late.join('–')})</>}: +10 puan yeşil değişimiyle <b>{signed(observed.effect_per_10pts, 2)} °C</b>
              {Number.isFinite(observed.low) && Number.isFinite(observed.high) && <> (aralık {signed(observed.low, 2)} … {signed(observed.high, 2)} °C)</>}.
            </div>
          )}
        </div>
      </div>

      {input.limited && (
        <p className="notice warn">
          Girilen alan yeşil payı ve senaryo sınırlarına kırpıldı; <b>{fmt(applied.hectares, 1)} ha</b> ile hesaplandı. Bu ilçede en fazla {fmt(input.max_add_hectares, 0)} ha ekleme
          (yeşil payı üst sınırı ve +{fmt(input.max_add_points, 0)} puan sınırı içinde), en fazla {fmt(input.max_loss_points * result.district.urban_km2, 0)} ha yeşil kaybı hesaplanabilir.
        </p>
      )}

      {support?.supported === false && (
        <p className="notice warn">Bu senaryoya benzer gözlemlerde veri desteği zayıf; sonucu keşif amaçlı bir model tahmini olarak okuyun.</p>
      )}

      <h4>Yüzey sıcaklığı: ilçenin kendi aralığında nerede?</h4>
      <BandBar min={info.measured.min} max={info.measured.max} minYear={info.measured.min_year} maxYear={info.measured.max_year}
        current={lst.current} value={lst.new} low={lst.new_low} high={lst.new_high} />

      <div className="target">
        <div className="target-controls">
          <label>
            Isı hedefi:&nbsp;
            <select value={cooling} onChange={(e) => onCooling(Number(e.target.value))}>
              {[0.5, 1, 1.5, 2].map((c) => <option key={c} value={c}>{fmt(c, 1)} °C serinleme</option>)}
            </select>
          </label>
          {target.reachable && onApplyTarget && (
            <button type="button" className="target-apply-btn" onClick={onApplyTarget}>
              Hedefe Ulaş ({targetText(target.hectares)} Uygula)
            </button>
          )}
        </div>
        {target.reachable ? (
          <p>
            Model hesabında bu ilçede <b>{fmt(target.cooling, 1)} °C</b> serinleme için <b>{fmt(Math.ceil(target.points * 10 - 1e-9) / 10, 1)} puan ≈ {targetText(target.hectares)}</b> yeşil gerekir
            {effect.has_range !== false && Number.isFinite(target.hectares_low) && Number.isFinite(target.hectares_high) && <> (örnekleme duyarlılık aralığı {targetText(target.hectares_low)} – {targetText(target.hectares_high)})</>}
            {target.hectares_high === null && <> (duyarlılık aralığının zayıf ucunda bu hedefe ulaşılamıyor)</>}.
          </p>
        ) : (
          <p>Model hesabında bu ilçede, yeşil payı en fazla +{fmt(input.max_add_points, 0)} puan artırarak <b>{fmt(target.cooling, 1)} °C</b> serinlemeye ulaşılamıyor.</p>
        )}
      </div>

      <div className="curve-section">
        <h4>Ne kadar yeşil, ne kadar serinleme? (Yanıt Eğrisi)</h4>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={curve.map((p) => ({ ...p, band: [p.low, p.high] }))} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="points" type="number" domain={[-20, 30]} ticks={[-20, -10, 0, 10, 20, 30]} label={{ value: 'eklenen yeşil (puan)', position: 'insideBottom', offset: -10 }} />
            <YAxis unit=" °C" width={55} tickFormatter={(v) => fmt(v, 1)} />
            <Tooltip formatter={(v) => (Array.isArray(v) ? `${fmt(v[0], 2)} … ${fmt(v[1], 2)}` : fmt(v, 2))} labelFormatter={(p) => `${p > 0 ? '+' : ''}${p} puan`} />
            <ReferenceLine y={0} stroke="#888" />
            <ReferenceLine y={-target.cooling} stroke={BLUE} strokeDasharray="4 4" label={{ value: `hedef −${fmt(target.cooling, 1)} °C`, position: 'insideBottomRight', fontSize: 11, fill: BLUE }} />
            <Area isAnimationActive={false} type="monotone" dataKey="band" name="duyarlılık aralığı" stroke="none" fill={GREEN} fillOpacity={0.2} />
            <Line isAnimationActive={false} type="monotone" dataKey="effect" name="beklenen değişim" stroke={GREEN} strokeWidth={2} dot={false} />
            <ReferenceDot x={Math.max(-20, Math.min(30, applied.points))} y={effect.value} r={6} fill={BLUE} stroke="#fff" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="fine">
        Hesap, {result.district.base_year} verisi ve “tipik yaz” hava koşulu için; yapılaşmış alanın yüzey sıcaklığına aittir (hava sıcaklığı değil). Sonuç, ilçeler arası ilişkilerden öğrenilmiş ampirik bir tahmindir.
      </p>
    </div>
  )
}
