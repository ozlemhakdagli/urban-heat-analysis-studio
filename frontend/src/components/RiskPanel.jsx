import { fmt, riskColor } from '../format.js'

function Bar({ label, value, hint }) {
  return (
    <div className="bar-row">
      <div className="bar-label"><span>{label}</span><span className="muted">{hint}</span></div>
      <div className="bar"><div style={{ width: `${value}%`, background: riskColor(value) }} /></div>
    </div>
  )
}

export default function RiskPanel({ info, topRisk, onPick }) {
  const r = info && info.risk
  return (
    <div className="risk">
      {!r && <p className="empty">Bir ilçe seçtiğinizde risk skoru burada görünür. Aşağıda en riskli 20 ilçe var; birine tıklayarak seçebilirsiniz.</p>}
      {r && (
        <>
          <div className="headline">
            <div className="big" style={{ color: riskColor(r.score) }}>{fmt(r.score, 0)}<small> / 100</small></div>
            <div className="big-text">
              Risk sırası <b>{r.rank} / {r.n}</b>
              <div className="muted">Örneklenen ağırlık setlerinde sıra duyarlılık aralığı {r.rank_low}–{r.rank_high} · bu setlerin %{fmt(r.top_share * 100, 0)}’inde ilk %10’da</div>
            </div>
          </div>
          <Bar label="Isı (tehlike)" value={r.components.hazard_pct} hint={`son yaz ${fmt(info.compare.recent_lst)} °C`} />
          <Bar label="Maruz kalan kırılgan nüfus" value={r.components.exposure_pct} hint={`${fmt(r.vulnerable_people, 0)} kişi (0–4 ve 65+ yaş)`} />
          <Bar label="Gelişmişlik düşüklüğü" value={r.components.vulnerability_pct} hint="SEGE-2022" />
          <p className="muted">
            {r.priority_rank
              ? <>Öncelik sırası: <b>{r.priority_rank} / {r.n_priority}</b> (kırılgan kişi ÷ 1 °C için gereken hektar; yalnızca sıralama içindir, mutlak sayı değildir).</>
              : <>Bu ilçede 1 °C serinlemeye ulaşılamadığı için öncelik sırası yok.</>}
          </p>
          {(Number.isFinite(r.priority_reachability) || Number.isFinite(r.priority_rank_low) || Number.isFinite(r.priority_top20_share)) && (
            <p className="muted">
              {Number.isFinite(r.priority_reachability) && <>Model örneklerinin %{fmt(r.priority_reachability * 100, 0)}’inde 1 °C hedefi erişilebilir.</>}
              {Number.isFinite(r.priority_rank_low) && Number.isFinite(r.priority_rank_high) && <> Hedefe ulaşılabilen örneklerde öncelik sırası duyarlılık aralığı: {fmt(r.priority_rank_low, 0)}–{fmt(r.priority_rank_high, 0)}.</>}
              {Number.isFinite(r.priority_top20_share) && <> Tüm örneklerin %{fmt(r.priority_top20_share * 100, 0)}’inde ilk 20 öncelik içinde.</>}
            </p>
          )}
          {r.small_area && <p className="notice warn">Küçük yapılaşmış alan, hektar başına öncelik oranını yükseltebilir; nüfus kapsamı ve alan ölçümünü birlikte değerlendirin.</p>}
        </>
      )}
      <h4>En riskli 20 ilçe (Tıklayıp Senaryoya Geçin)</h4>
      <ol className="toplist">
        {topRisk.map((t) => (
          <li key={t.code} className={info && info.code === t.code ? 'on' : ''}>
            <button onClick={() => onPick(t.code, 'whatif')} title="Bu ilçeyi seç ve yeşil senaryosuna geç">
              <span className="rank">{t.rank}</span>
              <span className="name">{t.name} <small>{t.city_name}</small></span>
              <span className="score" style={{ background: riskColor(t.score) }}>{fmt(t.score, 0)}</span>
              <span className="action-hint">Senaryoyu Aç →</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="fine">Risk skoru bir sıralama aracıdır, ölçüm değildir: ısı, kırılgan nüfus sayısı ve düşük gelişmişliğin eşit ağırlıklı ortalaması.</p>
    </div>
  )
}
