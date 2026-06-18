import { useEffect, useState } from 'react';
import api, { Family, User, MemberType, MEMBER_TYPE_LABELS, MEMBER_TYPE_WEIGHTS } from '../api';

const MEMBER_COLORS: Record<MemberType, string> = { ADULT: 'adult', CHILD: 'child', INFANT: 'infant' };

export default function PeoplePage() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [newFamily, setNewFamily] = useState('');
  const [newMember, setNewMember] = useState({ firstName: '', memberType: 'ADULT' as MemberType, familyId: '' });
  const [editingFamily, setEditingFamily] = useState<{ id: number; name: string } | null>(null);
  const [editingUser, setEditingUser] = useState<{ id: number; firstName: string; memberType: MemberType } | null>(null);

  const load = () => api.get('/families').then(r => setFamilies(r.data));
  useEffect(() => { load(); }, []);

  const addFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamily.trim()) return;
    await api.post('/families', { name: newFamily.trim() });
    setNewFamily('');
    load();
  };

  const saveFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFamily) return;
    await api.patch(`/families/${editingFamily.id}`, { name: editingFamily.name });
    setEditingFamily(null);
    load();
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/users', {
      firstName: newMember.firstName,
      memberType: newMember.memberType,
      familyId: Number(newMember.familyId),
    });
    setNewMember({ firstName: '', memberType: 'ADULT', familyId: newMember.familyId });
    load();
  };

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    await api.patch(`/users/${editingUser.id}`, {
      firstName: editingUser.firstName,
      memberType: editingUser.memberType,
    });
    setEditingUser(null);
    load();
  };

  const deleteMember = async (id: number) => {
    await api.delete(`/users/${id}`);
    load();
  };

  const deleteFamily = async (id: number) => {
    if (!confirm('Удалить семью со всеми участниками?')) return;
    await api.delete(`/families/${id}`);
    load();
  };

  return (
    <div className="page">
      <h1>Участники</h1>

      {/* Список семей */}
      <div className="families-list">
        {families.length === 0 && <p className="empty">Добавьте первую семью ниже</p>}
        {families.map(family => (
          <div key={family.id} className="card family-card">
            <div className="family-header">
              {editingFamily?.id === family.id ? (
                <form onSubmit={saveFamily} style={{ display: 'flex', gap: 8, flex: 1 }}>
                  <input required value={editingFamily.name} onChange={e => setEditingFamily(f => f && ({ ...f, name: e.target.value }))} style={{ flex: 1 }} />
                  <button type="submit" className="btn btn-primary btn-sm">✓</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingFamily(null)}>✕</button>
                </form>
              ) : (
                <>
                  <h3>Семья {family.name}</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingFamily({ id: family.id, name: family.name })}>✏️</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteFamily(family.id)}>Удалить</button>
                  </div>
                </>
              )}
            </div>
            <div className="members-grid">
              {family.members.map((member: User) => (
                <div key={member.id} className="member-chip">
                  <span>{member.firstName}</span>
                  <span className={`member-type ${MEMBER_COLORS[member.memberType]}`}>
                    {member.memberType === 'ADULT' ? 'взр.' : member.memberType === 'CHILD' ? 'реб.' : 'мл.'}
                    {' '}×{MEMBER_TYPE_WEIGHTS[member.memberType]}
                  </span>
                  <button onClick={() => setEditingUser({ id: member.id, firstName: member.firstName, memberType: member.memberType })}>✏️</button>
                  <button onClick={() => deleteMember(member.id)}>✕</button>
                </div>
              ))}
              {family.members.length === 0 && <span className="empty">Нет участников</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Редактирование участника (появляется по клику ✏️) */}
      {editingUser && (
        <div className="card">
          <form onSubmit={saveUser} className="form">
            <h3>Редактировать участника</h3>
            <div className="form-row">
              <label>Имя</label>
              <input required value={editingUser.firstName} onChange={e => setEditingUser(u => u && ({ ...u, firstName: e.target.value }))} />
            </div>
            <div className="form-row">
              <label>Тип</label>
              <select value={editingUser.memberType} onChange={e => setEditingUser(u => u && ({ ...u, memberType: e.target.value as MemberType }))}>
                {(Object.keys(MEMBER_TYPE_LABELS) as MemberType[]).map(t => (
                  <option key={t} value={t}>{MEMBER_TYPE_LABELS[t]} (×{MEMBER_TYPE_WEIGHTS[t]})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary">Сохранить</button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>Отмена</button>
            </div>
          </form>
        </div>
      )}

      {/* Добавить участника */}
      <div className="card">
        <h3>Добавить участника</h3>
        <form onSubmit={addMember} className="form">
          <div className="form-row">
            <label>Семья</label>
            <select required value={newMember.familyId} onChange={e => setNewMember(m => ({ ...m, familyId: e.target.value }))}>
              <option value="">Выберите семью...</option>
              {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Имя</label>
            <input required value={newMember.firstName} onChange={e => setNewMember(m => ({ ...m, firstName: e.target.value }))} placeholder="Шимон" />
          </div>
          <div className="form-row">
            <label>Тип</label>
            <select value={newMember.memberType} onChange={e => setNewMember(m => ({ ...m, memberType: e.target.value as MemberType }))}>
              {(Object.keys(MEMBER_TYPE_LABELS) as MemberType[]).map(t => (
                <option key={t} value={t}>{MEMBER_TYPE_LABELS[t]} (×{MEMBER_TYPE_WEIGHTS[t]})</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Добавить</button>
        </form>
      </div>

      {/* Добавить семью */}
      <div className="card">
        <h3>Добавить семью</h3>
        <form onSubmit={addFamily} style={{ display: 'flex', gap: 8 }}>
          <input required value={newFamily} onChange={e => setNewFamily(e.target.value)} placeholder="Иоффе" style={{ flex: 1 }} />
          <button type="submit" className="btn btn-primary">Добавить</button>
        </form>
      </div>
    </div>
  );
}
