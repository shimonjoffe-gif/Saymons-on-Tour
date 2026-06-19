import { useState, useEffect, useRef } from 'react';
import api, { Notification } from '../api';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import ParserSettings from './ParserSettings';
import CreateMatchModal from './CreateMatchModal';
import { parseMatchFromText } from '../utils/matchParser';

export default function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [createFrom, setCreateFrom] = useState<Notification | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  async function fetchUnreadCount() {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnread(data.count);
    } catch {
      // ignore
    }
  }

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: number) {
    await api.patch(`/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  }

  async function markAllRead() {
    await api.patch('/notifications/read-all');
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
  }

  function openCreateMatch(notif: Notification, e: React.MouseEvent) {
    e.stopPropagation();
    setOpen(false);
    setCreateFrom(notif);
    // Mark as read
    if (!notif.read) markRead(notif.id);
  }

  function openSettings() {
    setOpen(false);
    setShowSettings(true);
  }

  return (
    <>
      <div className="notif-wrapper" ref={panelRef}>
        <button className="notif-bell" onClick={handleOpen} aria-label="Уведомления">
          🔔
          {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
        </button>

        {open && (
          <div className="notif-panel">
            <div className="notif-panel-header">
              <span>Уведомления</span>
              <div className="notif-panel-actions">
                {unread > 0 && (
                  <button className="notif-action-btn" onClick={markAllRead}>
                    Прочитать все
                  </button>
                )}
                <button
                  className="notif-action-btn"
                  onClick={openSettings}
                  title="Настройки источников"
                >
                  ⚙️
                </button>
              </div>
            </div>

            <div className="notif-list">
              {loading && <div className="notif-empty">Загрузка…</div>}
              {!loading && notifications.length === 0 && (
                <div className="notif-empty">Нет уведомлений. Нажмите ⚙️ чтобы настроить источники.</div>
              )}
              {!loading && notifications.map(n => (
                <div
                  key={n.id}
                  className={`notif-item${n.read ? '' : ' notif-item--unread'}`}
                  onClick={() => !n.read && markRead(n.id)}
                >
                  <div className="notif-item-title">{n.title}</div>
                  <div className="notif-item-body">{n.body}</div>
                  <div className="notif-item-meta">
                    <span>{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ru })}</span>
                    <div className="notif-item-actions">
                      {n.type === 'match' && (
                        <button
                          className="notif-create-btn"
                          onClick={e => openCreateMatch(n, e)}
                          title="Создать матч из этого сообщения"
                        >
                          + матч
                        </button>
                      )}
                      {n.sourceUrl && (
                        <a
                          href={n.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="notif-item-link"
                          onClick={e => e.stopPropagation()}
                        >
                          →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showSettings && (
        <ParserSettings onClose={() => setShowSettings(false)} />
      )}

      {createFrom && (
        <CreateMatchModal
          initial={parseMatchFromText(createFrom.body, createFrom.source)}
          notificationText={createFrom.body}
          onClose={() => setCreateFrom(null)}
          onCreated={() => setCreateFrom(null)}
        />
      )}
    </>
  );
}
