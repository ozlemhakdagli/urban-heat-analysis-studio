import { CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmt } from '../format.js'
import { useTranslation } from '../i18n.js'

const ORANGE = '#e65100'
const GREEN = '#2e7d32'
const BLUE = '#1565c0'

function CompareRows({ title, rows, digits, color, lang }) {
  const values = rows.map((r) => r.value)
  const lo = Math.min(...values), hi = Math.max(...values)
  const pad = (hi - lo || 1) * 0.35
  const at = (v) => `${((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100}%`
  return (
    <div className="compare">
      <h4>{title}</h4>
      {rows.map((r, i) => (
        <div className="compare-row" key={r.name}>
          <span className="compare-name">{r.name}</span>
          <div className="compare-track"><i style={{ left: at(r.value), background: color, outline: i === 0 ? `3px solid ${color}55` : 'none' }} /></div>
          <b>{fmt(r.value, digits, lang)}</b>
        </div>
      ))}
    </div>
  )
}

export default function HistoryPanel({ info, result }) {
  const { lang, t } = useTranslation()
  if (!info) return <p className="empty">{t('historyEmptyPrompt')}</p>

  const history = info.history.map((h) => ({ year: h.year, lst: h.lst, green: +(h.green_share * 100).toFixed(1), temp: h.temp_mean }))
  if (result) history[history.length - 1].after = result.lst.new
  const m = info.measured
  const c = info.compare
  const temps = history.flatMap((h) => [h.lst, h.after]).filter((v) => v !== undefined)
  const tLow = Math.floor(Math.min(...temps) - 0.5)
  const tHigh = Math.ceil(Math.max(...temps) + 0.5)
  const comparison = [
    { name: t('nameThisDistrict'), lst: c.recent_lst, green: +(info.green_share * 100).toFixed(1) },
    { name: t('nameCityMedian', { city: info.city_name }), lst: c.city_median_lst, green: +(c.city_median_green * 100).toFixed(1) },
    { name: t('nameNationalMedian'), lst: c.national_median_lst, green: +(c.national_median_green * 100).toFixed(1) },
  ]

  return (
    <div className="history-panel">
      <div className="chart-card">
        <h4>{t('historyChartTitle', { from: history[0].year, to: history[history.length - 1].year })}</h4>
        <p className="muted">{t('historyChartSub')}</p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={history} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="year" />
            <YAxis yAxisId="t" domain={[tLow, tHigh]} allowDecimals={false} tickFormatter={(v) => fmt(v, 0, lang)} unit=" °C" width={55} />
            <YAxis yAxisId="g" orientation="right" domain={[0, 'dataMax + 10']} unit=" %" width={45} />
            <Tooltip formatter={(v, name) => [fmt(v, 1, lang), name]} />
            <Legend />
            <ReferenceLine yAxisId="t" y={m.min} stroke="#888" strokeDasharray="4 4" label={{ value: t('labelLowest'), position: 'insideBottomLeft', fontSize: 11, fill: '#666' }} />
            <ReferenceLine yAxisId="t" y={m.max} stroke="#888" strokeDasharray="4 4" label={{ value: t('labelHighest'), position: 'insideTopLeft', fontSize: 11, fill: '#666' }} />
            <Line isAnimationActive={false} yAxisId="t" type="monotone" dataKey="lst" name={t('legendLST')} stroke={ORANGE} strokeWidth={2} dot={{ r: 3 }} />
            <Line isAnimationActive={false} yAxisId="t" type="monotone" dataKey="after" name={t('legendAfter')} stroke={BLUE} strokeWidth={0} dot={{ r: 6, fill: BLUE }} />
            <Line isAnimationActive={false} yAxisId="g" type="monotone" dataKey="green" name={t('legendGreen')} stroke={GREEN} strokeDasharray="5 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="benchmark-card">
        <h4>{t('benchmarkTitle')}</h4>
        <p className="muted">{t('benchmarkSub')}</p>
        <div className="two">
          <CompareRows title={t('compareTitleLST')} rows={comparison.map((r) => ({ name: r.name, value: r.lst }))} digits={1} color={ORANGE} lang={lang} />
          <CompareRows title={t('compareTitleGreen')} rows={comparison.map((r) => ({ name: r.name, value: r.green }))} digits={1} color={GREEN} lang={lang} />
        </div>
      </div>
    </div>
  )
}
