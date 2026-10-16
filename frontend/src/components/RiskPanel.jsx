import { fmt, riskColor } from '../format.js'
import { useTranslation } from '../i18n.js'

function Bar({ label, value, hint }) {
  return (
    <div className="bar-row">
      <div className="bar-label"><span>{label}</span><span className="muted">{hint}</span></div>
      <div className="bar"><div style={{ width: `${value}%`, background: riskColor(value) }} /></div>
    </div>
  )
}

export default function RiskPanel({ info, topRisk, onPick }) {
  const { lang, t } = useTranslation()
  const r = info && info.risk

  return (
    <div className="risk">
      {!r && <p className="empty">{t('riskEmptyPrompt')}</p>}
      {r && (
        <>
          <div className="headline">
            <div className="big" style={{ color: riskColor(r.score) }}>{fmt(r.score, 0, lang)}<small> / 100</small></div>
            <div className="big-text">
              {t('riskRankOutOf', { rank: r.rank, total: r.n })}
              <div className="muted">{t('riskSensitivity', { low: r.rank_low, high: r.rank_high, share: fmt(r.top_share * 100, 0, lang) })}</div>
            </div>
          </div>
          <Bar label={t('barHazard')} value={r.components.hazard_pct} hint={t('barHazardHint', { temp: fmt(info.compare.recent_lst, 1, lang) })} />
          <Bar label={t('barExposure')} value={r.components.exposure_pct} hint={t('barExposureHint', { count: fmt(r.vulnerable_people, 0, lang) })} />
          <Bar label={t('barVulnerability')} value={r.components.vulnerability_pct} hint={t('barVulnerabilityHint')} />
          <p className="muted">
            {r.priority_rank
              ? t('priorityRank', { rank: r.priority_rank, total: r.n_priority })
              : t('priorityUnreachable')}
          </p>
          {(Number.isFinite(r.priority_reachability) || Number.isFinite(r.priority_rank_low) || Number.isFinite(r.priority_top20_share)) && (
            <p className="muted">
              {Number.isFinite(r.priority_reachability) && t('priorityReachability', { share: fmt(r.priority_reachability * 100, 0, lang) })}{' '}
              {Number.isFinite(r.priority_rank_low) && Number.isFinite(r.priority_rank_high) && t('priorityRankRange', { low: fmt(r.priority_rank_low, 0, lang), high: fmt(r.priority_rank_high, 0, lang) })}{' '}
              {Number.isFinite(r.priority_top20_share) && t('priorityTop20Share', { share: fmt(r.priority_top20_share * 100, 0, lang) })}
            </p>
          )}
          {r.small_area && <p className="notice warn">{t('smallAreaRiskWarning')}</p>}
        </>
      )}
      <h4>{t('top20RiskTitle')}</h4>
      <ol className="toplist">
        {topRisk.map((tItem) => (
          <li key={tItem.code} className={info && info.code === tItem.code ? 'on' : ''}>
            <button onClick={() => onPick(tItem.code, 'whatif')} title={t('top20ItemTooltip')}>
              <span className="rank">{tItem.rank}</span>
              <span className="name">{tItem.name} <small>{tItem.city_name}</small></span>
              <span className="score" style={{ background: riskColor(tItem.score) }}>{fmt(tItem.score, 0, lang)}</span>
              <span className="action-hint">{t('actionOpenScenario')}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="fine">{t('riskDisclaimer')}</p>
    </div>
  )
}
