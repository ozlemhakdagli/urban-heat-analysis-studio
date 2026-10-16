import usePlanner from './usePlanner.js'
import MapView from './components/MapView.jsx'
import Selectors from './components/Selectors.jsx'
import WhatIfPanel from './components/WhatIfPanel.jsx'
import RiskPanel from './components/RiskPanel.jsx'
import HistoryPanel from './components/HistoryPanel.jsx'
import LLMReportCard from './components/LLMReportCard.jsx'
import { useTranslation } from './i18n.js'
import { fmt, pct } from './format.js'

export default function App() {
  const { lang, setLang, t } = useTranslation()
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
        <div className="header-top">
          <div className="header-brand">
            <h1>{t('headerTitle')}</h1>
            <span className="badge">{t('headerBadge')}</span>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="lang-toggle-btn"
              onClick={() => setLang(lang === 'en' ? 'tr' : 'en')}
              title={lang === 'en' ? 'Türkçe arayüze geç' : 'Switch to English'}
              aria-label="Change language"
            >
              <span className={lang === 'en' ? 'lang-active' : ''}>EN</span>
              <span className="lang-sep">|</span>
              <span className={lang === 'tr' ? 'lang-active' : ''}>TR</span>
            </button>
          </div>
        </div>
        <p className="header-subtitle">
          {t('headerSubtitle')}
        </p>
      </header>

      {failed && (
        <p className="notice warn">
          {t('serverError')}
          <button type="button" onClick={retryAll}>{t('retry')}</button>
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
                <span>{t('regionLabel')}: <b>{info.region}</b></span>
                <span>{t('builtUpLabel')}: <b>{fmt(info.urban_km2, 1, lang)} km²</b></span>
                <span>{t('currentGreenLabel')}: <b>{pct(info.green_share, 1, lang)}</b></span>
                <span>{t('summerLSTLabel')}: <b>{fmt(info.measured.current, 1, lang)} °C</b></span>
              </div>
            </div>
          )}

          <div className="tabs" role="tablist">
            <button
              role="tab"
              className={tab === 'whatif' ? 'on' : ''}
              onClick={() => setTab('whatif')}
            >
              {t('tabWhatif')}
            </button>
            <button
              role="tab"
              className={tab === 'risk' ? 'on' : ''}
              onClick={() => setTab('risk')}
            >
              {t('tabRisk')}
            </button>
            <button
              role="tab"
              className={tab === 'history' ? 'on' : ''}
              onClick={() => setTab('history')}
            >
              {t('tabHistory')}
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

      <LLMReportCard
        districtCode={districtCode}
        amount={amount}
        unit={unit}
        cooling={cooling}
        districtName={info?.name}
        enabled={!!districtCode && !failed && !infoError && !noResult}
      />

      <footer className="footer">
        {t('footerText')}
      </footer>
    </div>
  )
}
