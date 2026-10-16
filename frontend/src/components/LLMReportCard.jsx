import { useState, useEffect, useRef, useCallback } from 'react'
import { marked } from 'marked'
import { streamLLMInterpretation } from '../api.js'
import { parseAmount } from '../format.js'
import { useTranslation } from '../i18n.js'

marked.setOptions({
  gfm: true,
  breaks: true,
})

function useLLMReport({ districtCode, amount, unit = 'ha', cooling = 1.0, enabled = true, lang = 'en' }) {
  const [text, setText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  const [modelName, setModelName] = useState('gemma-4-26b-a4b-it-qat')
  const abortControllerRef = useRef(null)

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setStreaming(false)
  }, [])

  const generate = useCallback(() => {
    abort()
    const numericAmount = typeof amount === 'number' ? amount : parseAmount(amount)
    if (!enabled || !districtCode || !Number.isFinite(numericAmount)) return

    const controller = new AbortController()
    abortControllerRef.current = controller

    setStreaming(true)
    setError(null)
    setText('')

    streamLLMInterpretation(
      { district_code: districtCode, amount: numericAmount, unit, cooling, lang },
      (chunk) => {
        if (controller.signal.aborted) return
        if (chunk.model) setModelName(chunk.model)
        if (chunk.error) {
          setError(chunk.error)
          setStreaming(false)
        } else if (chunk.done) {
          setStreaming(false)
        } else if (chunk.token) {
          setText((prev) => prev + chunk.token)
        }
      },
      controller.signal
    ).catch((err) => {
      if (controller.signal.aborted) return
      setError(err.message || 'LM Studio connection error')
      setStreaming(false)
    })
  }, [districtCode, amount, unit, cooling, enabled, lang, abort])

  useEffect(() => {
    abort()
    setText('')
    setError(null)
  }, [districtCode, amount, unit, cooling, lang, abort])

  return { text, streaming, error, modelName, abort, generate }
}

function ReportContent({ text, streaming }) {
  if (!text) return null
  const html = marked.parse(text)

  return (
    <div className="llm-report-content">
      <div className="llm-markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
      {streaming && <span className="typing-cursor" aria-hidden="true" />}
    </div>
  )
}

export default function LLMReportCard({
  districtCode,
  amount,
  unit = 'ha',
  cooling = 1.0,
  districtName,
  enabled = true,
}) {
  const { lang, t } = useTranslation()

  const { text, streaming, error, modelName, abort, generate } = useLLMReport({
    districtCode,
    amount,
    unit,
    cooling,
    enabled,
    lang,
  })

  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    if (!text) return
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // Ignore clipboard write failures
    })
  }, [text])

  const statusLabel = streaming
    ? t('llmStatusStreaming')
    : error
    ? t('llmStatusError')
    : text
    ? t('llmStatusDone')
    : t('llmStatusReady')

  const statusDotClass = streaming
    ? 'streaming'
    : error
    ? 'error'
    : text
    ? 'ready'
    : 'idle'

  return (
    <section className={`studio-llm-report ${streaming ? 'streaming-active' : ''}`}>
      <div className="llm-report-header">
        <div className="llm-header-title-group">
          <h3 className="llm-report-title">
            <span>🤖 {t('llmTitle')}</span>
          </h3>
          <span className="llm-model-badge" title={t('llmBadgeModelTitle')}>
            {modelName}
          </span>
          {districtName && (
            <span className="llm-district-tag" title={t('llmDistrictTagTitle')}>
              📍 {districtName}
            </span>
          )}
          <span className="llm-status-pill">
            <span className={`llm-status-dot ${statusDotClass}`} />
            {statusLabel}
          </span>
        </div>

        <div className="llm-report-actions">
          {streaming ? (
            <button type="button" className="llm-btn btn-stop" onClick={abort}>
              ⏹ {t('btnStop')}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="llm-btn btn-primary-ai"
                onClick={generate}
                disabled={!districtCode || !enabled}
                title={t('btnGenerateTitle')}
              >
                ✨ {t('btnGetAi')}
              </button>

              {text && (
                <button
                  type="button"
                  className="llm-btn"
                  onClick={generate}
                  disabled={!districtCode || !enabled}
                  title={t('btnRegenerateTitle')}
                >
                  🔄 {t('btnRegenerate')}
                </button>
              )}
            </>
          )}

          <button
            type="button"
            className={`llm-btn ${copied ? 'btn-copy copied' : ''}`}
            onClick={handleCopy}
            disabled={!text}
            title={t('btnCopyTitle')}
          >
            📋 {copied ? t('btnCopied') : t('btnCopy')}
          </button>
        </div>
      </div>

      <div className="llm-report-body">
        {error && (
          <div className="llm-error-state notice warn">
            <div className="llm-error-title">⚠️ {t('llmErrorTitle')}</div>
            <p className="llm-error-msg">{error}</p>
            <p className="llm-error-hint">
              {t('llmErrorHint')}
            </p>
            <button type="button" className="btn-retry" onClick={generate}>
              {t('btnRetry')}
            </button>
          </div>
        )}

        {text || streaming ? (
          <ReportContent text={text} streaming={streaming} />
        ) : !error ? (
          <div className="llm-idle-placeholder">
            <div className="llm-placeholder-icon">🌱</div>
            <p className="llm-placeholder-text">
              {districtName
                ? t('llmIdleDistrict', { district: districtName })
                : t('llmIdleGeneric')
              }
            </p>
            {districtCode && enabled && (
              <button type="button" className="llm-btn btn-primary-ai btn-hero" onClick={generate}>
                ✨ {districtName ? t('btnGetAiDistrict', { district: districtName }) : t('btnGetAi')}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}
