import { useState } from 'react';
import api, { SportType } from '../api';
import type { ParsedMatch } from '../utils/matchParser';

interface Props {
  initial: Partial<ParsedMatch>;
  notificationText: string;
  onClose: () => void;
  onCreated: () => void;
}

const SPORT_OPTIONS: { value: SportType; label: string; icon: string }[] = [
  { value: 'FOOTBALL', label: 'Зенит', icon: '⚽' },
  { value: 'HANDBALL', label: 'Зенит (гандбол)', icon: '🤾' },
  { value: 'YOUTH', label: 'Зенит-2', icon: '⚽²' },
  { value: 'WOMEN', label: 'ЖФК Зенит', icon: '🌸' },
];

export default function CreateMatchModal({ initial, notificationText, onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    sportType: initial.sportType ?? 'FOOTBALL' as SportType,
    opponent: initial.opponent ?? '',
    date: initial.date ?? '',
    city: initial.city ?? '',
    venue: initial.venue ?? '',
    description: initial.description ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.opponent.trim()) return setError('Укажите соперника');
    if (!form.date) return setError('Укажите дату');
    if (!form.city.trim()) return setError('Укажите город');

    setSubmitting(true);
    try {
      await api.post('/events', {
        sportType: form.sportType,
        opponent: form.opponent.trim(),
        date: new Date(form.date).toISOString(),
        city: form.city.trim(),
        venue: form.venue.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        onCreated();
        onClose();
      }, 1200);
    } catch {
      setError('Ошибка при создании матча');
    } finally {
      setSubmitting(false);
    }
  }

  // Highlight unparsed fields
  const missingOpponent = !form.opponent;
  const missingDate = !form.date;
  const missingCity = !form.city;

  return (
    <div className="cmm-overlay" onClick={onClose}>
      <div className="cmm-modal" onClick={e => e.stopPropagation()}>
        <div className="cmm-header">
          <span>🗓️ Создать матч</span>
          <button className="cmm-close" onClick={onClose}>✕</button>
        </div>

        {/* Source text excerpt */}
        <div className="cmm-source">
          <div className="cmm-source-label">Из уведомления:</div>
          <div className="cmm-source-text">{notificationText.slice(0, 200)}{notificationText.length > 200 ? '…' : ''}</div>
        </div>

        {success ? (
          <div className="cmm-success">✅ Матч добавлен в календарь!</div>
        ) : (
          <form className="cmm-form" onSubmit={handleSubmit}>
            {/* Sport type */}
            <div className="cmm-field">
              <label>Вид спорта</label>
              <div className="cmm-sport-grid">
                {SPORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`cmm-sport-btn${form.sportType === opt.value ? ' active' : ''}`}
                    onClick={() => set('sportType', opt.value)}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Opponent */}
            <div className={`cmm-field${missingOpponent ? ' cmm-field--warn' : ''}`}>
              <label>
                Соперник
                {missingOpponent && <span className="cmm-warn-tag">не распознан</span>}
              </label>
              <input
                className="cmm-input"
                placeholder="Например: ЦСКА"
                value={form.opponent}
                onChange={e => set('opponent', e.target.value)}
              />
            </div>

            {/* Date */}
            <div className={`cmm-field${missingDate ? ' cmm-field--warn' : ''}`}>
              <label>
                Дата и время
                {missingDate && <span className="cmm-warn-tag">не распознана</span>}
              </label>
              <input
                className="cmm-input"
                type="datetime-local"
                value={form.date}
                onChange={e => set('date', e.target.value)}
              />
            </div>

            {/* City */}
            <div className={`cmm-field${missingCity ? ' cmm-field--warn' : ''}`}>
              <label>
                Город
                {missingCity && <span className="cmm-warn-tag">не распознан</span>}
              </label>
              <input
                className="cmm-input"
                placeholder="Например: Москва"
                value={form.city}
                onChange={e => set('city', e.target.value)}
              />
            </div>

            {/* Venue (optional) */}
            <div className="cmm-field">
              <label>Стадион <span className="cmm-optional">(необязательно)</span></label>
              <input
                className="cmm-input"
                placeholder="Например: Лужники"
                value={form.venue}
                onChange={e => set('venue', e.target.value)}
              />
            </div>

            {/* Description (optional) */}
            <div className="cmm-field">
              <label>Заметка <span className="cmm-optional">(необязательно)</span></label>
              <input
                className="cmm-input"
                placeholder="Турнир, тур, ссылка..."
                value={form.description}
                onChange={e => set('description', e.target.value)}
              />
            </div>

            {error && <div className="cmm-error">{error}</div>}

            <button className="cmm-btn-submit" type="submit" disabled={submitting}>
              {submitting ? 'Создание…' : '+ Добавить в календарь'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
