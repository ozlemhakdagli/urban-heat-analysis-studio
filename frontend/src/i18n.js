import { createContext, createElement, useContext, useState, useMemo, useCallback } from 'react'

export const translations = {
  en: {
    // Header
    headerTitle: 'Urban Heat Analysis Studio',
    headerBadge: 'Turkey Urban Heat Island & Green Simulation',
    headerSubtitle: 'Simulate the summer land surface temperature impact of adding urban green canopy · Landsat 8/9 & ERA5 (2013–2025) · 829 districts',
    serverError: 'Cannot reach the server. Is the backend running? (uvicorn backend.main:app --port 8000)',
    retry: 'Retry',

    // Selectors
    provinceLabel: 'Province',
    selectProvince: 'Select province…',
    districtLabel: 'District',
    selectDistrict: 'Select district…',
    selectProvinceFirst: 'Select province first',
    noResultSmallBuiltUp: 'built-up area too small',
    noResultTooFewDistricts: 'too few districts in province',
    noResultPrefix: '(no result: {reason})',
    amountLabel: 'Added green space',
    minusLossHint: '(negative = green loss)',
    amountPlaceholder: 'e.g. 10000',
    unitM2: 'm²',
    unitHa: 'hectares',
    unitKm2: 'km²',
    unitAria: 'Unit',
    preset1ha: '1 ha',
    preset10ha: '10 ha',
    preset5pts: '+5 pts',
    preset10pts: '+10 pts',
    pointsTooltip5: 'Add green equal to 5% of built-up area',
    pointsTooltip10: 'Add green equal to 10% of built-up area',
    targetPresetLabel: '🎯 Target −{cooling} °C',
    targetPresetTitle: 'Apply required area for −{cooling} °C cooling',

    // Map
    hideTiles: 'Hide Basemap',
    showTiles: 'Show Basemap',
    tilesTooltip: 'Basemap requires internet; turning it off keeps district boundaries and colors visible',
    resetTurkey: 'Back to Turkey',
    riskLabel: 'Risk',
    lowToHigh: 'low → high',
    noResultLegend: 'no result',
    mapLoading: 'Loading map…',
    mapLoadError: 'Failed to load map (server unreachable).',

    // Tabs
    tabWhatif: '🌿 Green Scenario',
    tabRisk: '⚠️ Risk & Priority',
    tabHistory: '📈 History & Benchmark',

    // District Identity Card
    regionLabel: 'Region',
    builtUpLabel: 'Built-up Area',
    currentGreenLabel: 'Current Green Share',
    summerLSTLabel: 'Summer LST',

    // What-If Panel
    noResultSmallBuiltUpDesc: 'Built-up area is under 0.5 km²; land surface temperature cannot be measured reliably at this scale.',
    noResultTooFewDistrictsDesc: 'Province has too few reliable districts (fewer than 3) for within-city comparison; no result produced.',
    noResultGeneric: 'No results available for this district.',
    loadingDistrict: 'Loading district data…',
    fetchError: 'Failed to fetch data (server unreachable).',
    emptySelectPrompt: 'Click a district on the map or select from dropdowns above, then enter the green area to simulate.',
    invalidAmountPrompt: 'Please enter a valid numeric green area (e.g. 10000).',
    calculating: 'Calculating…',
    headlineAdded: 'adding',
    headlineLost: 'losing',
    detailBuiltUpShare: 'Green equal to {points}% of built-up area',
    samplingRangeUnavailable: 'sampling range unavailable',
    samplingSensitivity: 'sensitivity range: {low} … {high} °C',
    greenShareTransition: 'green share {from} → {to}',
    observedRelation: 'Distinct historical association ({early} → {late}): {effect} °C per +10 pts green change',
    observedRange: 'range {low} … {high} °C',
    limitedNotice: 'Requested area was clipped to physical and scenario bounds; calculated with {hectares} ha. In this district, maximum addition is {maxHa} ha (green share cap and +{maxPts} pts limit), maximum loss is {lossHa} ha.',
    outsideSupportNotice: 'Scenario has weak empirical data support among comparable Turkish districts; interpret result as an exploratory estimate.',
    bandBarTitle: 'Surface temperature: where does it stand within district’s own historical range?',
    bandBarDotNew: 'New: {val} °C',
    bandBarDotCurrent: 'Current: {val} °C',
    minMaxSummerLST: 'district lowest / highest summer mean',
    targetCoolingLabel: 'Cooling target:',
    targetCoolingOption: '{temp} °C cooling',
    targetApplyBtn: 'Reach Target (Apply {ha})',
    targetNeeded: 'Based on model calculations, approximately {hectares} ({points} pts) green space is required for −{cooling} °C cooling',
    targetLowHighRange: 'sampling sensitivity range: {low} – {high}',
    targetHighUnreachable: 'target is unreachable at the conservative end of sensitivity range',
    targetUnreachable: 'In this district, −{cooling} °C cooling target cannot be reached by increasing green share up to +{maxPts} pts cap.',
    curveTitle: 'How much green, how much cooling? (Response Curve)',
    curveXAxis: 'added green (points)',
    curveRefLine: 'target −{cooling} °C',
    curveAreaName: 'sensitivity range',
    curveLineName: 'expected change',
    whatifFine: 'Calculation uses {year} base data and “typical summer” weather conditions; applies to built-up urban surface temperature (not 2m air temp). Results are empirical machine learning predictions.',

    // Risk Panel
    riskEmptyPrompt: 'Risk score will appear here once a district is selected. Below are the 20 highest-risk districts; click any to inspect.',
    riskRankOutOf: 'Risk rank: {rank} / {total}',
    riskSensitivity: 'Rank sensitivity range in sampled weights: {low}–{high} · in top 10% in {share}% of sets',
    barHazard: 'Heat (hazard)',
    barHazardHint: 'recent summer: {temp} °C',
    barExposure: 'Exposed vulnerable population',
    barExposureHint: '{count} people (ages 0–4 and 65+)',
    barVulnerability: 'Socioeconomic disadvantage',
    barVulnerabilityHint: 'SEGE-2022',
    priorityRank: 'Priority rank: {rank} / {total} (vulnerable people ÷ hectares needed for 1 °C cooling; relative comparison only).',
    priorityUnreachable: '1 °C cooling is unreachable in this district; priority rank not assigned.',
    priorityReachability: '1 °C target reachable in {share}% of model draws.',
    priorityRankRange: 'Conditional rank sensitivity: {low}–{high}.',
    priorityTop20Share: 'In top 20 priorities across {share}% of all draws.',
    smallAreaRiskWarning: 'Small built-up area may inflate priority ratio per hectare; consider population coverage alongside area metrics.',
    top20RiskTitle: 'Top 20 Districts at Highest Risk (Click to simulate)',
    top20ItemTooltip: 'Select this district and switch to green scenario',
    actionOpenScenario: 'Simulate →',
    riskDisclaimer: 'The risk score is a comparative prioritization index, not an absolute measurement: equal-weighted mean of hazard, vulnerable population count, and socioeconomic disadvantage.',

    // History Panel
    historyEmptyPrompt: 'Select a district from the map.',
    historyChartTitle: 'Summer Land Surface Temperature & Green Share ({from}–{to})',
    historyChartSub: 'Measured July–August Landsat satellite data. Blue dot represents projected temperature under simulated green addition.',
    legendLST: 'Surface Temperature (°C)',
    legendAfter: 'Post-intervention (°C)',
    legendGreen: 'Green share (%)',
    labelLowest: 'lowest',
    labelHighest: 'highest',
    benchmarkTitle: 'District, Province and National Benchmark',
    benchmarkSub: 'Mean of the last three summers and district medians.',
    compareTitleLST: 'Surface Temperature (°C)',
    compareTitleGreen: 'Green Share (%)',
    nameThisDistrict: 'This district',
    nameCityMedian: '{city} median',
    nameNationalMedian: 'Turkey median',

    // LLM Decision Support Card
    llmTitle: 'AI Urban Planning Assessment Report',
    llmBadgeModelTitle: 'Active LLM Model',
    llmDistrictTagTitle: 'Evaluated District',
    llmStatusReady: 'Ready',
    llmStatusStreaming: 'Streaming Live',
    llmStatusError: 'Connection Warning',
    llmStatusDone: 'Completed',
    btnStop: 'Stop',
    btnRegenerate: 'Regenerate',
    btnCopy: 'Copy',
    btnCopied: 'Copied!',
    btnGetAi: 'Get AI Insights',
    btnGetAiDistrict: 'Get AI Insights for {district}',
    btnGenerateTitle: 'Generate AI urban assessment report for this scenario',
    btnRegenerateTitle: 'Regenerate report from scratch',
    btnCopyTitle: 'Copy report to clipboard',
    llmErrorTitle: 'LM Studio Connection Warning',
    llmErrorHint: 'Could not connect to LM Studio (http://127.0.0.1:1234). Please verify that LM Studio server and your model are running.',
    btnRetry: 'Try Again',
    llmIdleGeneric: 'Select a district and specify green space parameters, then click "Get AI Insights" to generate an expert thermal and planning assessment report.',
    llmIdleDistrict: 'Click "Get AI Insights" to generate an expert decision support evaluation for the simulated green canopy and cooling impacts in {district}.',

    // Footer
    footerText: 'Data: Landsat 8/9 summer land surface temperature and green share (July–August), ERA5 climate data, TurkStat population, SEGE-2022. Surface temperature refers to built-up area surface (not 2m air temperature). Results are empirical machine learning predictions learned from cross-district relations. 829 districts covered; 144 rural/small districts excluded methodologically.',
  },

  tr: {
    // Header
    headerTitle: 'Kentsel Isı Analiz Stüdyosu',
    headerBadge: 'Türkiye Kentsel Isı Adası & Yeşil Simülasyonu',
    headerSubtitle: 'İlçelere eklenecek kentsel yeşil dokunun yaz yüzey sıcaklığına etkisini simüle edin · Landsat 8/9 & ERA5 (2013–2025) · 829 ilçe',
    serverError: 'Sunucuya ulaşılamadı. Arka uç çalışıyor mu? (uvicorn backend.main:app --port 8000)',
    retry: 'Yeniden dene',

    // Selectors
    provinceLabel: 'İl',
    selectProvince: 'İl seçin…',
    districtLabel: 'İlçe',
    selectDistrict: 'İlçe seçin…',
    selectProvinceFirst: 'Önce il seçin',
    noResultSmallBuiltUp: 'yapılaşmış alan çok küçük',
    noResultTooFewDistricts: 'ilde yeterli ilçe yok',
    noResultPrefix: '(sonuç yok: {reason})',
    amountLabel: 'Eklenecek yeşil alan',
    minusLossHint: '(eksi = yeşil kaybı)',
    amountPlaceholder: 'örn. 10000',
    unitM2: 'm²',
    unitHa: 'hektar',
    unitKm2: 'km²',
    unitAria: 'Birim',
    preset1ha: '1 ha',
    preset10ha: '10 ha',
    preset5pts: '+5 puan',
    preset10pts: '+10 puan',
    pointsTooltip5: 'Yapılaşmış alanın %5’i kadar yeşil',
    pointsTooltip10: 'Yapılaşmış alanın %10’u kadar yeşil',
    targetPresetLabel: '🎯 Hedef −{cooling} °C',
    targetPresetTitle: '−{cooling} °C serinleme için gereken alanı uygula',

    // Map
    hideTiles: 'Altlığı kapat',
    showTiles: 'Altlığı aç',
    tilesTooltip: 'Harita altlığı (OpenStreetMap) internet ister; kapatırsan sınırlar ve renkler yine görünür',
    resetTurkey: 'Türkiye’ye dön',
    riskLabel: 'Risk',
    lowToHigh: 'düşük → yüksek',
    noResultLegend: 'sonuç yok',
    mapLoading: 'Harita yükleniyor…',
    mapLoadError: 'Harita yüklenemedi (sunucuya ulaşılamadı).',

    // Tabs
    tabWhatif: '🌿 Yeşil Senaryosu',
    tabRisk: '⚠️ Risk & Öncelik',
    tabHistory: '📈 Tarihçe & Kıyas',

    // District Identity Card
    regionLabel: 'Bölge',
    builtUpLabel: 'Yapılaşmış Alan',
    currentGreenLabel: 'Mevcut Yeşil Payı',
    summerLSTLabel: 'Yaz Sıcaklığı',

    // What-If Panel
    noResultSmallBuiltUpDesc: 'Bu ilçenin yapılaşmış alanı 0,5 km²’den küçük. Bu kadar küçük bir alanda yüzey sıcaklığı güvenilir ölçülemediği için sonuç üretilmiyor.',
    noResultTooFewDistrictsDesc: 'Bu ilde, ilçeleri şehir içinde karşılaştırmak için yeterli sayıda (en az 3) güvenilir ilçe yok; sonuç üretilmiyor.',
    noResultGeneric: 'Bu ilçe için sonuç yok.',
    loadingDistrict: 'İlçe verisi yükleniyor…',
    fetchError: 'Veri alınamadı (sunucuya ulaşılamadı).',
    emptySelectPrompt: 'Haritadan bir ilçeye tıklayın ya da yukarıdan il ve ilçe seçin; sonra eklemek istediğiniz yeşil alanı yazın.',
    invalidAmountPrompt: 'Eklenecek yeşil alan için bir sayı yazın (örn. 10000).',
    calculating: 'Hesaplanıyor…',
    headlineAdded: 'eklenirse',
    headlineLost: 'kaybedilirse',
    detailBuiltUpShare: 'Yapılaşmış alanın %{points}’i kadar yeşil',
    samplingRangeUnavailable: 'örnekleme aralığı mevcut değil',
    samplingSensitivity: 'duyarlılık aralığı: {low} … {high} °C',
    greenShareTransition: 'yeşil pay {from} → {to}',
    observedRelation: 'Ayrı tarihsel ilişki ({early} → {late}): +10 puan yeşil değişimiyle {effect} °C',
    observedRange: 'aralık {low} … {high} °C',
    limitedNotice: 'Girilen alan yeşil payı ve senaryo sınırlarına kırpıldı; {hectares} ha ile hesaplandı. Bu ilçede en fazla {maxHa} ha ekleme (yeşil payı üst sınırı ve +{maxPts} puan sınırı içinde), en fazla {lossHa} ha kayıp hesaplanabilir.',
    outsideSupportNotice: 'Bu senaryoya benzer gözlemlerde veri desteği zayıf; sonucu keşif amaçlı bir model tahmini olarak okuyun.',
    bandBarTitle: 'Yüzey sıcaklığı: ilçenin kendi aralığında nerede?',
    bandBarDotNew: 'Yeni: {val} °C',
    bandBarDotCurrent: 'Mevcut: {val} °C',
    minMaxSummerLST: 'ilçenin en düşük / en yüksek yaz ortalaması',
    targetCoolingLabel: 'Isı hedefi:',
    targetCoolingOption: '{temp} °C serinleme',
    targetApplyBtn: 'Hedefe Ulaş ({ha} Uygula)',
    targetNeeded: 'Model hesabında bu ilçede −{cooling} °C serinleme için {points} puan ≈ {hectares} yeşil gerekir',
    targetLowHighRange: 'örnekleme duyarlılık aralığı {low} – {high}',
    targetHighUnreachable: 'duyarlılık aralığının zayıf ucunda bu hedefe ulaşılamıyor',
    targetUnreachable: 'Model hesabında bu ilçede, yeşil payı en fazla +{maxPts} puan artırılarak −{cooling} °C serinlemeye ulaşılamıyor.',
    curveTitle: 'Ne kadar yeşil, ne kadar serinleme? (Yanıt Eğrisi)',
    curveXAxis: 'eklenen yeşil (puan)',
    curveRefLine: 'hedef −{cooling} °C',
    curveAreaName: 'duyarlılık aralığı',
    curveLineName: 'beklenen değişim',
    whatifFine: 'Hesap, {year} verisi ve “tipik yaz” hava koşulu için; yapılaşmış alanın yüzey sıcaklığına aittir (hava sıcaklığı değil). Sonuç, ilçeler arası ilişkilerden öğrenilmiş ampirik bir tahmindir.',

    // Risk Panel
    riskEmptyPrompt: 'Bir ilçe seçtiğinizde risk skoru burada görünür. Aşağıda en riskli 20 ilçe var; birine tıklayarak seçebilirsiniz.',
    riskRankOutOf: 'Risk sırası {rank} / {total}',
    riskSensitivity: 'Örneklenen ağırlık setlerinde sıra duyarlılık aralığı {low}–{high} · bu setlerin %{share}’inde ilk %10’da',
    barHazard: 'Isı (tehlike)',
    barHazardHint: 'son yaz {temp} °C',
    barExposure: 'Maruz kalan kırılgan nüfus',
    barExposureHint: '{count} kişi (0–4 ve 65+ yaş)',
    barVulnerability: 'Gelişmişlik düşüklüğü',
    barVulnerabilityHint: 'SEGE-2022',
    priorityRank: 'Öncelik sırası: {rank} / {total} (kırılgan kişi ÷ 1 °C için gereken hektar; yalnızca sıralama içindir, mutlak sayı değildir).',
    priorityUnreachable: 'Bu ilçede 1 °C serinlemeye ulaşılamadığı için öncelik sırası yok.',
    priorityReachability: 'Model örneklerinin %{share}’inde 1 °C hedefi erişilebilir.',
    priorityRankRange: 'Hedefe ulaşılabilen örneklerde öncelik sırası duyarlılık aralığı: {low}–{high}.',
    priorityTop20Share: 'Tüm örneklerin %{share}’inde ilk 20 öncelik içinde.',
    smallAreaRiskWarning: 'Küçük yapılaşmış alan, hektar başına öncelik oranını yükseltebilir; nüfus kapsamı ve alan ölçümünü birlikte değerlendirin.',
    top20RiskTitle: 'En riskli 20 ilçe (Tıklayıp Senaryoya Geçin)',
    top20ItemTooltip: 'Bu ilçeyi seç ve yeşil senaryosuna geç',
    actionOpenScenario: 'Senaryoyu Aç →',
    riskDisclaimer: 'Risk skoru bir sıralama aracıdır, ölçüm değildir: ısı, kırılgan nüfus sayısı ve düşük gelişmişliğin eşit ağırlıklı ortalaması.',

    // History Panel
    historyEmptyPrompt: 'Haritadan bir ilçe seçin.',
    historyChartTitle: 'Yaz yüzey sıcaklığı ve yeşil pay ({from}–{to})',
    historyChartSub: 'Her yıl Temmuz–Ağustos ölçülen Landsat verisi. Mavi nokta yeşil müdahalesi sonrası beklenen sıcaklıktır.',
    legendLST: 'Yüzey sıcaklığı (°C)',
    legendAfter: 'Müdahale sonrası (°C)',
    legendGreen: 'Yeşil pay (%)',
    labelLowest: 'en düşük',
    labelHighest: 'en yüksek',
    benchmarkTitle: 'İlçe, İl ve Türkiye Karşılaştırması',
    benchmarkSub: 'Son üç yazın ortalaması ve ilçe medyanları.',
    compareTitleLST: 'Yüzey sıcaklığı (°C)',
    compareTitleGreen: 'Yeşil pay (%)',
    nameThisDistrict: 'Bu ilçe',
    nameCityMedian: '{city} medyanı',
    nameNationalMedian: 'Türkiye medyanı',

    // LLM Decision Support Card
    llmTitle: 'Yapay Zeka Kentsel Değerlendirme Raporu',
    llmBadgeModelTitle: 'Aktif LLM Modeli',
    llmDistrictTagTitle: 'Değerlendirilen İlçe',
    llmStatusReady: 'Hazır',
    llmStatusStreaming: 'Canlı Akış',
    llmStatusError: 'Bağlantı Uyarısı',
    llmStatusDone: 'Tamamlandı',
    btnStop: 'Durdur',
    btnRegenerate: 'Yeniden Üret',
    btnCopy: 'Kopyala',
    btnCopied: 'Kopyalandı!',
    btnGetAi: 'AI Yorumu Al',
    btnGetAiDistrict: '{district} İçin AI Yorumu Al',
    btnGenerateTitle: 'Bu senaryo için yapay zeka kentsel değerlendirme raporu üret',
    btnRegenerateTitle: 'Raporu baştan üret',
    btnCopyTitle: 'Raporu panoya kopyala',
    llmErrorTitle: 'LM Studio Bağlantı Uyarısı',
    llmErrorHint: 'LM Studio bağlantısı kurulamadı (http://127.0.0.1:1234). Modelinizin ve sunucunuzun açık olduğunu kontrol edin.',
    btnRetry: 'Tekrar Dene',
    llmIdleGeneric: 'Haritadan bir ilçe seçip yeşil doku miktarını belirledikten sonra "AI Yorumu Al" butonuna tıklayarak uzman değerlendirmesi alabilirsiniz.',
    llmIdleDistrict: '{district} ilçesi için simüle edilen kentsel yeşil doku artışı ve yüzey sıcaklığı etkilerini değerlendirmek için "AI Yorumu Al" butonuna tıklayın.',

    // Footer
    footerText: 'Veriler: Landsat 8/9 yaz yüzey sıcaklığı ve yeşil pay (Temmuz–Ağustos), ERA5 iklim verisi, TÜİK nüfus, SEGE-2022. Yüzey sıcaklığı yapılaşmış alanın sıcaklığıdır (hava sıcaklığı değil). Sonuçlar ilçeler arası ilişkilerden öğrenilmiş ampirik makine öğrenmesi tahminleridir. 829 ilçe için sonuç vardır; 144 kırsal/küçük ilçe metodolojik olarak kapsam dışıdır.',
  },
}

export function interpolate(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) =>
    params[key] !== undefined ? String(params[key]) : match
  )
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem('ugp.lang') || 'en'
    } catch {
      return 'en'
    }
  })

  const setLang = useCallback((nextLang) => {
    const valid = nextLang === 'tr' ? 'tr' : 'en'
    setLangState(valid)
    try {
      localStorage.setItem('ugp.lang', valid)
    } catch {
      // ignore
    }
  }, [])

  const t = useCallback(
    (key, params = {}) => {
      const dict = translations[lang] || translations.en
      const template = dict[key] ?? translations.en[key] ?? key
      return interpolate(template, params)
    },
    [lang]
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return createElement(I18nContext.Provider, { value }, children)
}

export function useTranslation() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    return {
      lang: 'en',
      setLang: () => {},
      t: (key, params = {}) => interpolate(translations.en[key] || key, params),
    }
  }
  return ctx
}
