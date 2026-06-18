import { useState, useEffect } from 'react';
import api, { ParserSource } from '../api';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Props {
  onClose: () => void;
}

const TYPE_LABELS = {
  telegram: { icon: '✈️', label: 'Telegram' },
  website: { icon: '🌐', label: 'Сайт' },
};

export default function ParserSettings({ onClose }: Props) {
  const [sources, setSources] = useState<ParserSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const [form, setForm] = useState({ type: 'telegram', identifier: '', label: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/parser/sources');
      setSources(data);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSource(id: number, enabled: boolean) {
    await api.patch(`/parser/sources/${id}`, { enabled });
    setSources(prev => prev.map(s => s.id === id ? { ...s, enabled } : s));
  }

  async function deleteSource(id: number) {
    await api.delete(`/parser/sources/${id}`);
    setSources(prev => prev.filter(s => s.id !== id));
  }

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.identifier.trim() || !form.label.trim()) {
      setFormError('Заполните все поля');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/parser/sources', form);
      setSources(prev => [...prev, data]);
      setForm(f => ({ ...f, identifier: '', label: '' }));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg || 'Ошибка при добавлении');
    } finally {
      setSubmitting(false);
    }
  }

  async function runNow() {
    setRunning(true);
    try {
      await api.post('/parser/run');
      await load();
    } finally {
      setRunning(false);
    }
  }

  function formatLastRun(source: ParserSource) {
    if (!source.state?.lastRunAt) return 'Ещё не запускался';
    if (source.state.errorMessage) {
      return `Ошибка: ${source.state.errorMessage.slice(0, 60)}`;
    }
    return formatDistanceToNow(new Date(source.state.lastRunAt), { addSuffix: true, locale: ru });
  }

  const tgSources = sources.filter(s => s.type === 'telegram');
  const webSources = sources.filter(s => s.type === 'website');

  return (
    <div className="ps-overlay" onClick={onClose}>
      <div className="ps-modal" onClick={e => e.stopPropagation()}>
        <div className="ps-header">
          <span>⚙️ Источники парсера</span>
          <button className="ps-close" onClick={onClose}>✕</button>
        </div>

        <div className="ps-body">
          {loading ? (
            <div className="ps-loading">Загрузка…</div>
          ) : (
            <>
              {/* Telegram channels */}
              <div className="ps-section-label">
                ✈️ Telegram каналы
              </div>
              {tgSources.length === 0 && (
                <div className="ps-empty">Нет каналов</div>
              )}
              {tgSources.map(src => (
                <SourceRow
                  key={src.id}
                  source={src}
                  lastRunText={formatLastRun(src)}
                  onToggle={en => toggleSource(src.id, en)}
                  onDelete={() => deleteSource(src.id)}
                />
              ))}

              {/* Websites */}
              <div className="ps-section-label" style={{ marginTop: 12 }}>
                🌐 Сайты
              </div>
              {webSources.length === 0 && (
                <div className="ps-empty">Нет сайтов</div>
              )}
              {webSources.map(src => (
                <SourceRow
                  key={src.id}
                  source={src}
                  lastRunText={formatLastRun(src)}
                  onToggle={en => toggleSource(src.id, en)}
                  onDelete={() => deleteSource(src.id)}
                />
              ))}

              {/* Add form */}
              <div className="ps-section-label" style={{ marginTop: 16 }}>
                Добавить источник
              </div>
              <form className="ps-form" onSubmit={addSource}>
                <div className="ps-form-row">
                  <select
                    className="ps-select"
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  >
                    <option value="telegram">✈️ Telegram</option>
                    <option value="website">🌐 Сайт</option>
                  </select>
                </div>
                <input
                  className="ps-input"
                  placeholder={form.type === 'telegram' ? '@channel или t.me/channel' : 'https://example.com'}
                  value={form.identifier}
                  onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))}
                />
                <input
                  className="ps-input"
                  placeholder="Название (например: Зенит-2)"
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                />
                {formError && <div className="ps-form-error">{formError}</div>}
                <button className="ps-btn-add" type="submit" disabled={submitting}>
                  {submitting ? 'Добавление…' : '+ Добавить'}
                </button>
              </form>

              {/* Manual run */}
              <button
                className="ps-btn-run"
                onClick={runNow}
                disabled={running}
              >
                {running ? '⏳ Запускается…' : '🔄 Запустить парсер сейчас'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceRow({
  source,
  lastRunText,
  onToggle,
  onDelete,
}: {
  source: ParserSource;
  lastRunText: string;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  const hasError = !!source.state?.errorMessage;

  return (
    <div className={`ps-source-row${source.enabled ? '' : ' ps-source-row--disabled'}`}>
      <div className="ps-source-info">
        <div className="ps-source-label">{source.label}</div>
        <div className={`ps-source-meta${hasError ? ' ps-source-meta--error' : ''}`}>
          {source.type === 'telegram' ? `@${source.identifier}` : source.identifier}
          {' · '}
          {lastRunText}
        </div>
      </div>
      <div className="ps-source-actions">
        <button
          className={`ps-toggle${source.enabled ? ' ps-toggle--on' : ''}`}
          onClick={() => onToggle(!source.enabled)}
          title={source.enabled ? 'Отключить' : 'Включить'}
        >
          {source.enabled ? 'ВКЛ' : 'ВЫКЛ'}
        </button>
        <button className="ps-delete" onClick={onDelete} title="Удалить">✕</button>
      </div>
    </div>
  );
}
