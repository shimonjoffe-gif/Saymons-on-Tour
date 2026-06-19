import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  format, addMonths, subMonths, addYears, subYears,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import api, { Event, User, SportType, SPORT_LABELS } from '../api';

// Название команды для отображения
const TEAM_LABEL: Record<SportType, string> = {
  FOOTBALL: 'Зенит',
  HANDBALL: 'Зенит',
  YOUTH: 'Зенит-2',
  WOMEN: 'ЖФК Зенит',
};

// Иконки видов спорта
function SportIcon({ type, size = 16 }: { type: SportType; size?: number }) {
  if (type === 'WOMEN') {
    // Розовый футбольный мяч — точная копия ⚽ но в розовых тонах
    return (
      <svg width={size} height={size} viewBox="0 0 20 20"
        style={{ display: 'inline-block', verticalAlign: '-0.15em', flexShrink: 0 }}>
        {/* основной круг */}
        <circle cx="10" cy="10" r="9.2" fill="#ffe4f0" stroke="#e879a0" strokeWidth="0.8" />
        {/* центральный пятиугольник (верх) */}
        <polygon points="10,2.8 12.7,4.9 11.7,8 8.3,8 7.3,4.9" fill="#e879a0" />
        {/* нижний левый */}
        <polygon points="3.5,13.2 6.2,11 8.3,12.8 7.5,16.2 4.2,15.5" fill="#e879a0" />
        {/* нижний правый */}
        <polygon points="16.5,13.2 13.8,11 11.7,12.8 12.5,16.2 15.8,15.5" fill="#e879a0" />
        {/* швы */}
        <line x1="10" y1="2.8" x2="7.3" y2="4.9" stroke="#e879a0" strokeWidth="0.7" />
        <line x1="10" y1="2.8" x2="12.7" y2="4.9" stroke="#e879a0" strokeWidth="0.7" />
        <line x1="8.3" y1="8" x2="6.2" y2="11" stroke="#e879a0" strokeWidth="0.7" />
        <line x1="11.7" y1="8" x2="13.8" y2="11" stroke="#e879a0" strokeWidth="0.7" />
        <line x1="6.2" y1="11" x2="3.5" y2="13.2" stroke="#e879a0" strokeWidth="0.7" />
        <line x1="13.8" y1="11" x2="16.5" y2="13.2" stroke="#e879a0" strokeWidth="0.7" />
        <line x1="7.5" y1="16.2" x2="12.5" y2="16.2" stroke="#e879a0" strokeWidth="0.7" />
        <line x1="8.3" y1="8" x2="11.7" y2="8" stroke="#e879a0" strokeWidth="0.7" />
        <line x1="6.2" y1="11" x2="8.3" y2="12.8" stroke="#e879a0" strokeWidth="0.7" />
        <line x1="13.8" y1="11" x2="11.7" y2="12.8" stroke="#e879a0" strokeWidth="0.7" />
      </svg>
    );
  }

  if (type === 'YOUTH') {
    // ⚽ с кружком «2» сверху справа
    return (
      <span style={{ position: 'relative', display: 'inline-block', lineHeight: 1 }}>
        <span style={{ fontSize: size }}>⚽</span>
        <span style={{
          position: 'absolute', top: -3, right: -5,
          fontSize: Math.round(size * 0.52),
          fontWeight: 900, color: '#fff',
          background: '#003DA5',
          borderRadius: '50%',
          width: Math.round(size * 0.65),
          height: Math.round(size * 0.65),
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1, border: '1px solid #fff',
        }}>2</span>
      </span>
    );
  }

  if (type === 'HANDBALL') {
    return <span style={{ fontSize: size, lineHeight: 1 }}>🤾</span>;
  }

  // FOOTBALL
  return <span style={{ fontSize: size, lineHeight: 1 }}>⚽</span>;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

type DayState = 'empty' | 'match' | 'planned' | 'done';

export default function CalendarPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState<number | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    sportType: 'FOOTBALL' as SportType,
    opponent: '',
    date: '',
    city: '',
    venue: '',
    description: '',
  });

  const load = () =>
    api.get('/events').then(r => setEvents(r.data));

  useEffect(() => {
    load();
    api.get('/users').then(r => setAllUsers(r.data));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/events', form);
      await load();
      setShowForm(false);
      setForm({ sportType: 'FOOTBALL', opponent: '', date: '', city: '', venue: '', description: '' });
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить матч?')) return;
    await api.delete(`/events/${id}`);
    setEvents(ev => ev.filter(e => e.id !== id));
  };

  const toggleMember = async (event: Event, userId: number) => {
    const key = `${event.id}-${userId}`;
    setToggling(key);
    try {
      let tripId = event.trip?.id;
      // Автоматически создаём выезд при первом участнике
      if (!tripId) {
        const { data: trip } = await api.post('/trips', { eventId: event.id });
        tripId = trip.id;
      }
      const isMember = event.trip?.members?.some(m => m.userId === userId);
      if (isMember) {
        await api.delete(`/trips/${tripId}/members/${userId}`);
      } else {
        await api.post(`/trips/${tripId}/members`, { userId });
      }
      await load();
    } finally {
      setToggling(null);
    }
  };

  // Calendar grid
  const today = new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEventsForDay = (day: Date) =>
    events.filter(ev => isSameDay(new Date(ev.date), day));

  const getDayState = (day: Date): DayState => {
    const evs = getEventsForDay(day);
    if (evs.length === 0) return 'empty';
    const hasMembers = evs.some(ev => ev.trip?.members && ev.trip.members.length > 0);
    if (!hasMembers) return 'match';
    return day > today ? 'planned' : 'done';
  };

  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  // Группировка участников по семьям
  const familyGroups = allUsers.reduce<Record<string, User[]>>((acc, u) => {
    const k = u.family.name;
    if (!acc[k]) acc[k] = [];
    acc[k]!.push(u);
    return acc;
  }, {});

  return (
    <div className="page">
      <div className="page-header">
        <h1>Выезды</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(f => !f); setSelectedDate(null); }}>
          {showForm ? 'Отмена' : '+ Матч'}
        </button>
      </div>

      {/* Форма нового матча */}
      {showForm && (
        <form className="card form" onSubmit={handleCreate}>
          <h3>Новый матч</h3>
          <div className="form-row">
            <label>Вид спорта</label>
            <select value={form.sportType} onChange={e => setForm(f => ({ ...f, sportType: e.target.value as SportType }))}>
              {(Object.keys(SPORT_LABELS) as SportType[]).map(s => (
                <option key={s} value={s}>{SPORT_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Соперник</label>
            <input required value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} placeholder="ЦСКА" />
          </div>
          <div className="form-row">
            <label>Дата и время</label>
            <input required type="datetime-local" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="form-row">
            <label>Город</label>
            <input required value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Москва" />
          </div>
          <div className="form-row">
            <label>Стадион</label>
            <input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder="Лужники" />
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Создание...' : 'Создать'}
          </button>
        </form>
      )}

      {/* Календарь */}
      <div className="card cal-card">
        <div className="cal-header">
          <button className="cal-nav-btn" onClick={() => { setCurrentMonth(m => subYears(m, 1)); setSelectedDate(null); }} title="Предыдущий год">«</button>
          <button className="cal-nav-btn" onClick={() => { setCurrentMonth(m => subMonths(m, 1)); setSelectedDate(null); }} title="Предыдущий месяц">‹</button>
          <button className="cal-month-label" onClick={() => setShowMonthPicker(v => !v)}>
            {format(currentMonth, 'LLLL yyyy', { locale: ru })} {showMonthPicker ? '▲' : '▼'}
          </button>
          <button className="cal-nav-btn" onClick={() => { setCurrentMonth(m => addMonths(m, 1)); setSelectedDate(null); }} title="Следующий месяц">›</button>
          <button className="cal-nav-btn" onClick={() => { setCurrentMonth(m => addYears(m, 1)); setSelectedDate(null); }} title="Следующий год">»</button>
          <button className="cal-today-btn" onClick={() => { setCurrentMonth(today); setSelectedDate(null); setShowMonthPicker(false); setPickerYear(null); }}>Сегодня</button>
        </div>

        {showMonthPicker && (() => {
          const curYear = currentMonth.getFullYear();
          const displayYear = pickerYear ?? curYear;
          const yearRange = Array.from({ length: 12 }, (_, i) => today.getFullYear() - 8 + i);
          return (
            <div className="cal-picker">
              {/* Сетка годов */}
              <div className="cal-picker-years">
                {yearRange.map(y => {
                  const hasEvents = events.some(ev => new Date(ev.date).getFullYear() === y);
                  const isActive = y === displayYear;
                  return (
                    <button key={y}
                      className={`cal-picker-year-btn${isActive ? ' selected' : ''}${hasEvents ? ' has-events' : ''}`}
                      onClick={() => setPickerYear(y)}
                    >
                      {y}
                      {hasEvents && <span className="cal-picker-dot" />}
                    </button>
                  );
                })}
              </div>
              {/* Сетка месяцев */}
              <div className="cal-picker-months">
                {Array.from({ length: 12 }, (_, i) => {
                  const d = new Date(displayYear, i, 1);
                  const isSelected = d.getMonth() === currentMonth.getMonth() && displayYear === curYear;
                  const hasEvents = events.some(ev => {
                    const ed = new Date(ev.date);
                    return ed.getFullYear() === displayYear && ed.getMonth() === i;
                  });
                  return (
                    <button key={i}
                      className={`cal-picker-month${isSelected ? ' selected' : ''}${hasEvents ? ' has-events' : ''}`}
                      onClick={() => {
                        setCurrentMonth(d);
                        setSelectedDate(null);
                        setShowMonthPicker(false);
                        setPickerYear(null);
                      }}
                    >
                      {format(d, 'MMM', { locale: ru })}
                      {hasEvents && <span className="cal-picker-dot" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="cal-grid">
          {WEEKDAYS.map(d => <div key={d} className="cal-weekday">{d}</div>)}
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            const state = getDayState(day);
            const inMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, today);
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;

            return (
              <div
                key={day.toISOString()}
                className={[
                  'cal-day',
                  !inMonth && 'cal-day--other',
                  isToday && 'cal-day--today',
                  state === 'match' && 'cal-day--match',
                  state === 'planned' && 'cal-day--planned',
                  state === 'done' && 'cal-day--done',
                  isSelected && 'cal-day--selected',
                  dayEvents.length > 0 ? 'cal-day--clickable' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  if (dayEvents.length === 0) return;
                  setShowForm(false);
                  setSelectedDate(d => d && isSameDay(d, day) ? null : day);
                }}
              >
                <span className="cal-day-num">{format(day, 'd')}</span>
                {inMonth && dayEvents.length === 1 && (
                  <span className="cal-day-icon"><SportIcon type={dayEvents[0].sportType} size={13} /></span>
                )}
                {inMonth && dayEvents.length > 1 && (
                  <span className="cal-day-icon"><span className="cal-day-count">{dayEvents.length}</span></span>
                )}
              </div>
            );
          })}
        </div>

        <div className="cal-legend">
          <span className="cal-legend-item"><span className="cal-legend-dot cal-legend-dot--match" />Матч</span>
          <span className="cal-legend-item"><span className="cal-legend-dot cal-legend-dot--planned" />Едем</span>
          <span className="cal-legend-item"><span className="cal-legend-dot cal-legend-dot--done" />Съездили</span>
        </div>
      </div>

      {/* Панель выбранного дня */}
      {selectedDayEvents.length > 0 && selectedDate && (
        <div className="day-panel">
          <div className="day-panel-date">
            {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
          </div>

          {selectedDayEvents.map(ev => {
            const isPast = new Date(ev.date) <= today;
            const memberCount = ev.trip?.members?.length ?? 0;

            return (
              <div key={ev.id} className={[
                'card event-trip-card',
                memberCount > 0 && !isPast ? 'event-trip-card--planned' : '',
                memberCount > 0 && isPast ? 'event-trip-card--done' : '',
              ].filter(Boolean).join(' ')}>

                {/* Шапка матча */}
                <div className="etcard-header">
                  <div className="etcard-teams">
                    <span className="etcard-sport"><SportIcon type={ev.sportType} size={22} /></span>
                    <span className="etcard-matchname">{TEAM_LABEL[ev.sportType]} — {ev.opponent}</span>
                  </div>
                  <button className="btn btn-danger btn-sm" style={{ padding: '0 10px', minHeight: 32 }} onClick={() => handleDelete(ev.id)}>✕</button>
                </div>

                <div className="etcard-meta">
                  <span>🕐 {format(new Date(ev.date), 'HH:mm')}</span>
                  <span>📍 {ev.city}{ev.venue ? `, ${ev.venue}` : ''}</span>
                  {ev.description && <span className="etcard-desc">{ev.description}</span>}
                </div>

                {/* Кто едет */}
                <div className="etcard-section-label">
                  {memberCount > 0 ? `Едут: ${memberCount} чел.` : 'Кто едет?'}
                </div>

                <div className="etcard-families">
                  {Object.entries(familyGroups).map(([familyName, members]) => (
                    <div key={familyName} className="etcard-family">
                      <span className="etcard-family-name">{familyName}</span>
                      <div className="etcard-members">
                        {members.map(user => {
                          const isGoing = ev.trip?.members?.some(m => m.userId === user.id) ?? false;
                          const key = `${ev.id}-${user.id}`;
                          const loading = toggling === key;
                          return (
                            <button
                              key={user.id}
                              className={`etcard-member-btn${isGoing ? ' going' : ''}`}
                              disabled={loading}
                              onClick={() => toggleMember(ev, user.id)}
                            >
                              {loading ? '…' : user.firstName}
                              {user.memberType === 'CHILD' ? ' 👶' : user.memberType === 'INFANT' ? ' 🍼' : ''}
                              {isGoing && ' ✓'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ссылка на расходы */}
                {ev.trip && memberCount > 0 && (
                  <Link to={`/trips/${ev.trip.id}`} className="btn btn-secondary btn-full" style={{ marginTop: 8 }}>
                    💰 Расходы и расчёты →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Ближайшие матчи */}
      {events.length > 0 && (
        <div className="upcoming-list">
          <h2 style={{ marginBottom: 4 }}>Ближайшие матчи</h2>
          {events
            .filter(ev => new Date(ev.date) >= today)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 15)
            .map(ev => {
              const members = ev.trip?.members?.length ?? 0;
              const state = members > 0 ? 'planned' : 'match';
              return (
                <div
                  key={ev.id}
                  className={`card upcoming-item upcoming-item--${state}`}
                  onClick={() => {
                    const d = new Date(ev.date);
                    setCurrentMonth(d);
                    setSelectedDate(d);
                    setShowForm(false);
                  }}
                >
                  <div className="upcoming-date">{format(new Date(ev.date), 'd MMM', { locale: ru })}</div>
                  <div className="upcoming-info">
                    <span className="upcoming-match"><SportIcon type={ev.sportType} size={14} /> {TEAM_LABEL[ev.sportType]} — {ev.opponent}</span>
                    <span className="upcoming-city">📍 {ev.city}</span>
                  </div>
                  {members > 0 && <span className="upcoming-badge">{members} чел.</span>}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
