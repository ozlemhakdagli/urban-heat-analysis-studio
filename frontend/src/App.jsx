import usePlanner from './usePlanner.js'
import MapView from './components/MapView.jsx'
import Selectors from './components/Selectors.jsx'
import WhatIfPanel from './components/WhatIfPanel.jsx'
import RiskPanel from './components/RiskPanel.jsx'
import HistoryPanel from './components/HistoryPanel.jsx'

export default function App() {
  const { state, actions } = usePlanner()
  const {
    meta, overview, topRisk, cityCode, districtCode, info, noResult,
    amount, unit, cooling, result, tab, failed, infoError, whatIfError,
    invalid, loadingInfo, bounds,
  } = state
  const {
    selectCity, selectDistrict, setAmount, setUnit, setCooling, setTab,
    retryAll, applyPreset, applyTargetCooling,
  } = actions

  return (
    <div className="page studio-layout">
      <header className="header">
        <div className="header-brand">
          <h1>Kentsel Yeşil Planlayıcı</h1>
          <span className="badge">Türkiye Kentsel Isı Adası & Yeşil Simülasyonu</span>
        </div>
        <p className="header-subtitle">
          İlçelere eklenecek kentsel yeşil dokunun yaz yüzey sıcaklığına etkisini simüle edin · Landsat 8/9 & ERA5 (2013–2025) · 829 ilçe
        </p>
      </header>

      {failed && (
        <p className="notice warn">
          Sunucuya ulaşılamadı. Arka uç çalışıyor mu? (<code>uvicorn backend.main:app --port 8000</code>)
          <button type="button" onClick={retryAll}>Yeniden dene</button>
        </p>
      )}

      <main className="studio-main">
        {/* Sol Sütun: Kontroller & Harita */}
        <section className="studio-col studio-map-col">
          <Selectors
            meta={meta}
            cityCode={cityCode}
            districtCode={districtCode}
            amount={amount}
            unit={unit}
            urbanKm2={info ? info.urban_km2 : null}
            cooling={cooling}
            onCity={selectCity}
            onDistrict={selectDistrict}
            onAmount={setAmount}
            onUnit={setUnit}
            onPreset={applyPreset}
            onTargetPreset={result?.target?.reachable ? applyTargetCooling : null}
          />

          <MapView
            overview={overview}
            selectedCity={cityCode}
            selectedDistrict={districtCode}
            bounds={bounds}
            onPick={selectDistrict}
            onReset={() => { selectCity(null); selectDistrict(null) }}
            overviewFailed={failed}
          />
        </section>

        {/* Sağ Sütun: Analitik Paneller */}
        <section className="studio-col studio-panel-col card">
          {info && (
            <div className="district-identity">
              <h2>{info.name} <small>({info.city_name})</small></h2>
              <div className="identity-tags">
                <span>Bölge: <b>{info.region}</b></span>
                <span>Yapılaşmış Alan: <b>{info.urban_km2} km²</b></span>
                <span>Mevcut Yeşil Payı: <b>%{(info.green_share * 100).toFixed(1)}</b></span>
                <span>Yaz Sıcaklığı: <b>{info.measured.current} °C</b></span>
              </div>
            </div>
          )}

          <div className="tabs" role="tablist">
            <button
              role="tab"
              className={tab === 'whatif' ? 'on' : ''}
              onClick={() => setTab('whatif')}
            >
              🌿 Yeşil Senaryosu
            </button>
            <button
              role="tab"
              className={tab === 'risk' ? 'on' : ''}
              onClick={() => setTab('risk')}
            >
              ⚠️ Risk & Öncelik
            </button>
            <button
              role="tab"
              className={tab === 'history' ? 'on' : ''}
              onClick={() => setTab('history')}
            >
              📈 Tarihçe & Kıyas
            </button>
          </div>

          <div className="tab-content">
            {tab === 'whatif' && (
              <WhatIfPanel
                info={info}
                result={result}
                noResult={noResult}
                invalid={invalid}
                cooling={cooling}
                onCooling={setCooling}
                onApplyTarget={applyTargetCooling}
                loading={loadingInfo}
                error={whatIfError || infoError}
                onRetry={retryAll}
              />
            )}
            {tab === 'risk' && (
              <RiskPanel
                info={info}
                topRisk={topRisk}
                onPick={selectDistrict}
              />
            )}
            {tab === 'history' && (
              <HistoryPanel
                info={info}
                result={result}
              />
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        Veriler: Landsat 8/9 yaz yüzey sıcaklığı ve yeşil pay (Temmuz–Ağustos), ERA5 iklim verisi, TÜİK nüfus, SEGE-2022.
        Yüzey sıcaklığı yapılaşmış alanın sıcaklığıdır (hava sıcaklığı değil). Sonuçlar ilçeler arası ilişkilerden öğrenilmiş ampirik makine öğrenmesi tahminleridir. 829 ilçe için sonuç vardır; 144 kırsal/küçük ilçe metodolojik olarak kapsam dışıdır.
      </footer>
    </div>
  )
}
