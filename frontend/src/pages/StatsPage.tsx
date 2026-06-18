import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import api from '../api';

interface TripEntry {
  tripId: number;
  opponent: string;
  date: string;
  city: string;
}

interface UserStat {
  userId: number;
  firstName: string;
  familyName: string;
  trips: TripEntry[];
}

export default function StatsPage() {
  const [stats, setStats] = useState<UserStat[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stats/trips')
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><p className="empty">Загрузка...</p></div>;

  return (
    <div className="page">
      <h1>Статистика</h1>

      {stats.length === 0 ? (
        <p className="empty">Нет данных — сначала добавьте выезды и отметьте участников</p>
      ) : (
        <div className="stats-list">
          {stats.map((s, i) => {
            const isOpen = expanded === s.userId;
            const sorted = [...s.trips].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            return (
              <div key={s.userId} className="card stats-card">
                <button
                  className="stats-row"
                  onClick={() => setExpanded(isOpen ? null : s.userId)}
                >
                  <span className="stats-rank">{i + 1}</span>
                  <span className="stats-name">{s.familyName} {s.firstName}</span>
                  <span className="stats-count">{s.trips.length}</span>
                  <span className="stats-chevron">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="stats-trips">
                    {sorted.map(t => (
                      <div key={t.tripId} className="stats-trip-row">
                        <div className="stats-trip-date">
                          {format(new Date(t.date), 'd MMM yyyy', { locale: ru })}
                        </div>
                        <div className="stats-trip-info">
                          <span className="stats-trip-match">Зенит — {t.opponent}</span>
                          <span className="stats-trip-city">📍 {t.city}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
