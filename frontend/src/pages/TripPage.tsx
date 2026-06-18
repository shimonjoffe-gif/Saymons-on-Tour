import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import api, {
  Trip, User, Expense, ExpenseCategory,
  CATEGORY_LABELS, CATEGORY_EMOJI, SPORT_LABELS, Settlement,
  MemberType, defaultWeight,
} from '../api';

// --- типы для формы ---
interface SplitRow { userId: number; name: string; familyName: string; memberType: MemberType; included: boolean; weight: number; }

function buildSplits(members: Trip['members'], category: ExpenseCategory): SplitRow[] {
  return members.map(m => {
    const w = defaultWeight(m.user.memberType, category);
    return { userId: m.userId, name: m.user.firstName, familyName: m.user.family.name, memberType: m.user.memberType, included: w > 0, weight: w };
  });
}

// --- Компонент таблицы участников (сгруппировано по семьям) ---
function SplitsEditor({ splits, onChange }: { splits: SplitRow[]; onChange: (s: SplitRow[]) => void }) {
  const toggle = (i: number) => {
    const next = [...splits]; next[i] = { ...next[i]!, included: !next[i]!.included }; onChange(next);
  };
  const setWeight = (i: number, val: string) => {
    const next = [...splits]; next[i] = { ...next[i]!, weight: parseFloat(val) || 0 }; onChange(next);
  };

  const families = Array.from(new Set(splits.map(s => s.familyName)));

  return (
    <div className="splits-editor">
      {families.map(family => (
        <div key={family}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 1, padding: '6px 2px 4px' }}>
            Семья {family}
          </div>
          {splits.map((s, i) => s.familyName !== family ? null : (
            <label key={s.userId} className={`split-editor-row ${s.included ? 'included' : 'excluded'}`}>
              <input type="checkbox" checked={s.included} onChange={() => toggle(i)} />
              <span className="split-name">{s.name}</span>
              <span className={`member-badge ${s.memberType.toLowerCase()}`}>
                {s.memberType === 'ADULT' ? 'взр.' : s.memberType === 'CHILD' ? 'реб.' : 'мл.'}
              </span>
              {s.included && (
                <input type="number" min="0" max="9" step="0.1" value={s.weight}
                  onChange={e => setWeight(i, e.target.value)} className="weight-input" />
              )}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

// --- Форма добавления расхода ---
function ExpenseForm({ trip, onDone }: { trip: Trip; onDone: () => void }) {
  const [payerId, setPayerId] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('FOOD');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [alcoholAmount, setAlcoholAmount] = useState('');
  const [withAlcohol, setWithAlcohol] = useState(false);
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [alcoholSplits, setAlcoholSplits] = useState<SplitRow[]>([]);

  // Пересчитываем splits при смене категории или состава
  useEffect(() => {
    setSplits(buildSplits(trip.members, category));
    if (category === 'FOOD') {
      setAlcoholSplits(buildSplits(trip.members, 'ALCOHOL'));
    }
  }, [category, trip.members]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const base = { payerId: Number(payerId), description, category };

    // Основной расход
    await api.post(`/trips/${trip.id}/expenses`, {
      ...base,
      amount: Number(amount),
      customSplits: splits.filter(s => s.included).map(s => ({ userId: s.userId, shareWeight: s.weight })),
    });

    // Алкоголь как отдельный расход
    if (category === 'FOOD' && withAlcohol && Number(alcoholAmount) > 0) {
      await api.post(`/trips/${trip.id}/expenses`, {
        payerId: Number(payerId),
        description: `${description} (алко)`,
        category: 'ALCOHOL',
        amount: Number(alcoholAmount),
        customSplits: alcoholSplits.filter(s => s.included).map(s => ({ userId: s.userId, shareWeight: s.weight })),
      });
    }

    onDone();
  };

  const isFood = category === 'FOOD';

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h3>Новый расход</h3>

      <div className="form-row">
        <label>Кто заплатил</label>
        <select required value={payerId} onChange={e => setPayerId(e.target.value)}>
          <option value="">Выберите...</option>
          {trip.members.map(m => (
            <option key={m.userId} value={m.userId}>{m.user.family.name} {m.user.firstName}</option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label>Категория</label>
        <select value={category} onChange={e => { setCategory(e.target.value as ExpenseCategory); setWithAlcohol(false); }}>
          {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map(c => (
            <option key={c} value={c}>{CATEGORY_EMOJI[c]} {CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label>Описание</label>
        <input required value={description} onChange={e => setDescription(e.target.value)} placeholder="Ужин в ресторане" />
      </div>

      {/* Сумма — одна или две строки для ресторана */}
      <div className="form-row">
        <label>{isFood ? 'Сумма за еду ₽' : 'Сумма ₽'}</label>
        <input required type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000" />
      </div>

      {isFood && (
        <label className="toggle" style={{ fontSize: 13 }}>
          <input type="checkbox" checked={withAlcohol} onChange={e => setWithAlcohol(e.target.checked)} />
          Добавить алкоголь отдельной суммой
        </label>
      )}

      {isFood && withAlcohol && (
        <>
          <div className="form-row">
            <label>Сумма за алкоголь ₽</label>
            <input required type="number" min="0" value={alcoholAmount} onChange={e => setAlcoholAmount(e.target.value)} placeholder="3000" />
          </div>
        </>
      )}

      {/* Участники основного расхода */}
      <div className="form-row">
        <label>{isFood && withAlcohol ? 'Участники (еда)' : 'Участники'}</label>
        <SplitsEditor splits={splits} onChange={setSplits} />
      </div>

      {/* Участники алкоголя */}
      {isFood && withAlcohol && (
        <div className="form-row">
          <label>Участники (алко)</label>
          <SplitsEditor splits={alcoholSplits} onChange={setAlcoholSplits} />
        </div>
      )}

      <button type="submit" className="btn btn-primary">Добавить</button>
    </form>
  );
}

// --- Карточка расхода ---
function ExpenseCard({ expense, allExpenses, tripMembers, onDelete, onUpdated }: {
  expense: Expense;
  allExpenses: Expense[];
  tripMembers: Trip['members'];
  onDelete: (id: number) => void;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(String(expense.amount));
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [withAlcohol, setWithAlcohol] = useState(false);
  const [alcoholAmount, setAlcoholAmount] = useState('');
  const [alcoholSplits, setAlcoholSplits] = useState<SplitRow[]>([]);
  const totalWeight = expense.splits.reduce((s, sp) => s + sp.shareWeight, 0);
  const isFood = expense.category === 'FOOD';

  const buildRows = (category: string, existing: Expense['splits']) =>
    tripMembers.map(m => {
      const ex = existing.find(s => s.userId === m.userId);
      return {
        userId: m.userId,
        name: m.user.firstName,
        familyName: m.user.family.name,
        memberType: m.user.memberType,
        included: !!ex,
        weight: ex ? ex.shareWeight : defaultWeight(m.user.memberType, category),
      };
    });

  const startEdit = () => {
    const pairedAlco = isFood
      ? allExpenses.find(e => e.category === 'ALCOHOL' && e.description === expense.description + ' (алко)')
      : null;
    setSplits(buildRows(expense.category, expense.splits));
    setAmount(String(expense.amount));
    setDescription(expense.description);
    if (pairedAlco) {
      setWithAlcohol(true);
      setAlcoholAmount(String(pairedAlco.amount));
      setAlcoholSplits(buildRows('ALCOHOL', pairedAlco.splits));
    } else {
      setWithAlcohol(false);
      setAlcoholAmount('');
      setAlcoholSplits(buildRows('ALCOHOL', []));
    }
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.patch(`/expenses/${expense.id}`, {
      description,
      amount: Number(amount),
      customSplits: splits.filter(s => s.included).map(s => ({ userId: s.userId, shareWeight: s.weight })),
    });

    if (isFood) {
      const pairedAlco = allExpenses.find(
        e => e.category === 'ALCOHOL' && e.description === expense.description + ' (алко)'
      );
      if (withAlcohol && Number(alcoholAmount) > 0) {
        const alcoSplitsData = alcoholSplits.filter(s => s.included).map(s => ({ userId: s.userId, shareWeight: s.weight }));
        if (pairedAlco) {
          await api.patch(`/expenses/${pairedAlco.id}`, {
            description: description + ' (алко)',
            amount: Number(alcoholAmount),
            customSplits: alcoSplitsData,
          });
        } else {
          await api.post(`/trips/${expense.tripId}/expenses`, {
            payerId: expense.payerId,
            description: description + ' (алко)',
            category: 'ALCOHOL',
            amount: Number(alcoholAmount),
            customSplits: alcoSplitsData,
          });
        }
      } else if (!withAlcohol && pairedAlco) {
        await api.delete(`/expenses/${pairedAlco.id}`);
      }
    }

    setEditing(false);
    onUpdated();
  };

  if (editing) {
    return (
      <form className="card form" onSubmit={handleSave}>
        <h3>{CATEGORY_EMOJI[expense.category]} Редактирование</h3>
        <div className="form-row">
          <label>Описание</label>
          <input required value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="form-row">
          <label>{isFood && withAlcohol ? 'Сумма за еду ₽' : 'Сумма ₽'}</label>
          <input required type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        {isFood && (
          <label className="toggle" style={{ fontSize: 13 }}>
            <input type="checkbox" checked={withAlcohol} onChange={e => {
              setWithAlcohol(e.target.checked);
              if (e.target.checked && alcoholSplits.length === 0)
                setAlcoholSplits(buildRows('ALCOHOL', []));
            }} />
            Алкоголь отдельной суммой
          </label>
        )}
        {isFood && withAlcohol && (
          <>
            <div className="form-row">
              <label>Сумма за алкоголь ₽</label>
              <input required type="number" min="0" value={alcoholAmount} onChange={e => setAlcoholAmount(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Участники (алко)</label>
              <SplitsEditor splits={alcoholSplits} onChange={setAlcoholSplits} />
            </div>
          </>
        )}
        <div className="form-row">
          <label>{isFood && withAlcohol ? 'Участники (еда)' : 'Участники'}</label>
          <SplitsEditor splits={splits} onChange={setSplits} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary">Сохранить</button>
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Отмена</button>
        </div>
      </form>
    );
  }

  return (
    <div className="card expense-card">
      <div className="expense-main" onClick={() => setExpanded(!expanded)}>
        <span className="expense-category">{CATEGORY_EMOJI[expense.category]}</span>
        <span className="expense-desc">{expense.description}</span>
        <span className="expense-payer">{expense.payer.family.name} {expense.payer.firstName}</span>
        <span className="expense-amount">{expense.amount.toLocaleString('ru')} ₽</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, gap: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Скрыть' : 'Участники'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={startEdit}>✏️ Изменить</button>
        <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); onDelete(expense.id); }}>Удалить</button>
      </div>
      {expanded && (
        <div className="expense-splits">
          {Array.from(new Set(expense.splits.map(s => s.user.family.name))).map(family => (
            <div key={family}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 1, padding: '6px 2px 2px' }}>
                Семья {family}
              </div>
              {expense.splits.filter(s => s.user.family.name === family).map(split => {
                const share = totalWeight > 0 ? (split.shareWeight / totalWeight) * expense.amount : 0;
                return (
                  <div key={split.id} className="split-row">
                    <span>{split.user.firstName}</span>
                    <span className="split-weight">×{split.shareWeight}</span>
                    <span className="split-amount">{share.toFixed(0)} ₽</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Расчёт долгов ---
function SettlementView({ settlement }: { settlement: Settlement }) {
  const [showPersonal, setShowPersonal] = useState(false);
  return (
    <div className="settlement">
      {settlement.transfers.length === 0 ? (
        <p className="empty">Все расчёты равные, переводы не нужны!</p>
      ) : (
        <>
          <h3>Переводы между семьями</h3>
          {settlement.transfers.map((t, i) => (
            <div key={i} className="transfer-row">
              <div className="transfer-families">
                <span className="transfer-from">{t.from}</span>
                <span className="transfer-arrow">→</span>
                <span className="transfer-to">{t.to}</span>
              </div>
              <span className="transfer-amount">{t.amount.toLocaleString('ru')} ₽</span>
            </div>
          ))}
        </>
      )}
      <h3>Баланс по семьям</h3>
      {[...settlement.familyBalances].sort((a, b) => b.netBalance - a.netBalance).map(b => (
        <div key={b.familyName} className={`balance-row ${b.netBalance >= 0 ? 'positive' : 'negative'}`}>
          <span>Семья {b.familyName}</span>
          <span>{b.netBalance >= 0 ? '+' : ''}{b.netBalance.toLocaleString('ru')} ₽</span>
        </div>
      ))}
      <button className="btn btn-secondary btn-sm" onClick={() => setShowPersonal(!showPersonal)}>
        {showPersonal ? 'Скрыть' : 'Показать'} детализацию по людям
      </button>
      {showPersonal && (
        <>
          <h3>Баланс по участникам</h3>
          {[...settlement.balances].sort((a, b) => b.netBalance - a.netBalance).map(b => (
            <div key={b.userId} className={`balance-row ${b.netBalance >= 0 ? 'positive' : 'negative'}`}>
              <span>{b.name}</span>
              <span>{b.netBalance >= 0 ? '+' : ''}{b.netBalance.toLocaleString('ru')} ₽</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// --- Главная страница выезда ---
export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showMembers, setShowMembers] = useState(true);

  const loadTrip = async () => {
    const { data } = await api.get(`/trips/${id}`);
    setTrip(data);
  };

  useEffect(() => {
    loadTrip();
    api.get('/users').then(r => setAllUsers(r.data));
  }, [id]);

  const toggleMember = async (userId: number) => {
    if (!trip) return;
    const isMember = trip.members.some(m => m.userId === userId);
    if (isMember) await api.delete(`/trips/${trip.id}/members/${userId}`);
    else await api.post(`/trips/${trip.id}/members`, { userId });
    loadTrip();
    setSettlement(null);
  };

  const toggleAttended = async (userId: number, current: boolean) => {
    if (!trip) return;
    await api.patch(`/trips/${trip.id}/members/${userId}`, { attendedMatch: !current });
    loadTrip();
  };

  const deleteExpense = async (expenseId: number) => {
    if (!confirm('Удалить расход?')) return;
    await api.delete(`/expenses/${expenseId}`);
    loadTrip();
    setSettlement(null);
  };

  const handleExpenseDone = () => {
    setShowExpenseForm(false);
    loadTrip();
    setSettlement(null);
  };

  if (!trip) return <div className="page">Загрузка...</div>;

  const familyGroups = allUsers.reduce<Record<string, User[]>>((acc, user) => {
    const key = user.family.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(user);
    return acc;
  }, {});

  const totalAmount = trip.expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="page">
      <Link to="/" className="back-link">← Все выезды</Link>

      <div className="trip-header">
        <h1>Зенит — {trip.event.opponent}</h1>
        <div className="trip-meta">
          <span>{SPORT_LABELS[trip.event.sportType]}</span>
          <span>📅 {format(new Date(trip.event.date), 'd MMMM yyyy, HH:mm', { locale: ru })}</span>
          <span>📍 {trip.event.city}{trip.event.venue ? `, ${trip.event.venue}` : ''}</span>
        </div>
      </div>

      {/* Участники */}
      <section className="section">
        <div className="section-header">
          <h2>Участники ({trip.members.length})</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowMembers(v => !v)}>
            {showMembers ? 'Свернуть' : 'Развернуть'}
          </button>
        </div>
        {showMembers && <div className="families-grid">
          {Object.entries(familyGroups).map(([familyName, members]) => (
            <div key={familyName} className="family-block">
              <div className="family-name">Семья {familyName}</div>
              {members.map(user => {
                const member = trip.members.find(m => m.userId === user.id);
                const isGoing = !!member;
                const attended = member?.attendedMatch ?? true;
                return (
                  <div key={user.id} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <button className={`member-btn ${isGoing ? 'going' : ''}`} style={{ flex: 1, marginBottom: 0 }} onClick={() => toggleMember(user.id)}>
                      {user.firstName}
                      <span style={{ fontSize: 11, opacity: 0.7 }}>
                        {' '}{user.memberType === 'ADULT' ? '' : user.memberType === 'CHILD' ? '(реб.)' : '(мл.)'}
                      </span>
                      {isGoing ? ' ✓' : ' +'}
                    </button>
                    {isGoing && (
                      <button
                        title={attended ? 'Был на матче' : 'Не был на матче'}
                        onClick={() => toggleAttended(user.id, attended)}
                        style={{
                          minWidth: 44, minHeight: 44, border: '1.5px solid',
                          borderRadius: 8, cursor: 'pointer', fontSize: 18,
                          background: attended ? 'var(--primary-light)' : 'var(--danger-light)',
                          borderColor: attended ? 'var(--primary)' : 'var(--danger)',
                        }}
                      >
                        {attended ? '⚽' : '🚫'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>}
      </section>

      {/* Расходы */}
      <section className="section">
        <div className="section-header">
          <h2>Расходы {totalAmount > 0 && <span className="total">Итого: {totalAmount.toLocaleString('ru')} ₽</span>}</h2>
          <button className="btn btn-primary" onClick={() => setShowExpenseForm(!showExpenseForm)}>
            {showExpenseForm ? 'Отмена' : '+ Расход'}
          </button>
        </div>

        {showExpenseForm && trip.members.length > 0 && (
          <ExpenseForm trip={trip} onDone={handleExpenseDone} />
        )}
        {showExpenseForm && trip.members.length === 0 && (
          <p className="empty card" style={{ padding: 16 }}>Сначала добавьте участников выезда</p>
        )}

        <div className="expenses-list">
          {trip.expenses.length === 0 && <p className="empty">Расходов пока нет</p>}
          {trip.expenses.map(expense => (
            <ExpenseCard key={expense.id} expense={expense} allExpenses={trip.expenses} tripMembers={trip.members} onDelete={deleteExpense} onUpdated={() => { loadTrip(); setSettlement(null); }} />
          ))}
        </div>
      </section>

      {/* Расчёт */}
      {trip.expenses.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>Итоговый расчёт</h2>
            <button className="btn btn-secondary" onClick={async () => {
              const { data } = await api.get(`/trips/${id}/settlement`);
              setSettlement(data);
            }}>
              {settlement ? 'Обновить' : 'Рассчитать'}
            </button>
          </div>
          {settlement && <SettlementView settlement={settlement} />}
        </section>
      )}
    </div>
  );
}
