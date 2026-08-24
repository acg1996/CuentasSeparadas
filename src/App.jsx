import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  computeBalances,
  computeSettlements,
  computeSpending,
  createId,
  createTrip,
  mergeTrips,
  normalizeShares,
  pickColor,
  totalShares,
} from './lib/trips.js'
import { buildShareLink, clearSharedTrip, loadData, readSharedTrip, saveData } from './lib/storage.js'

const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const percent = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 1 })

function emptyForm(trip) {
  return {
    description: '',
    amount: '',
    paidBy: trip.participants[0]?.id ?? '',
    sharedBy: trip.participants.map((participant) => participant.id),
  }
}

function initData() {
  const stored = loadData()
  const shared = readSharedTrip()
  if (!shared) return stored

  clearSharedTrip()
  // Se fusiona con lo que ya haya en este dispositivo para no perder gastos propios
  // ni los que haya añadido la otra persona.
  const trips = stored.trips.some((trip) => trip.id === shared.id)
    ? stored.trips.map((trip) => (trip.id === shared.id ? mergeTrips(trip, shared) : trip))
    : [shared, ...stored.trips]
  return { ...stored, trips, activeTripId: shared.id }
}

function App() {
  const [data, setData] = useState(initData)
  const [showPersonForm, setShowPersonForm] = useState(false)
  const [personName, setPersonName] = useState('')
  const [personShares, setPersonShares] = useState('1')
  const [sharesDrafts, setSharesDrafts] = useState({})
  const [shareStatus, setShareStatus] = useState('')

  const trip = data.trips.find((item) => item.id === data.activeTripId) ?? data.trips[0]
  const [form, setForm] = useState(() => emptyForm(trip))

  useEffect(() => {
    saveData(data)
  }, [data])

  useEffect(() => {
    setForm(emptyForm(trip))
    setShareStatus('')
    setSharesDrafts({})
    // Al cambiar de viaje el formulario debe apuntar a los participantes del nuevo viaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id])

  const balances = useMemo(() => computeBalances(trip), [trip])
  const spending = useMemo(() => computeSpending(trip), [trip])
  const settlements = useMemo(() => computeSettlements(trip, balances), [trip, balances])
  const total = trip.expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const shares = totalShares(trip.participants)

  function updateTrip(updater) {
    setData((current) => ({
      ...current,
      trips: current.trips.map((item) => (item.id === trip.id ? updater(item) : item)),
    }))
  }

  function updateTripName(event) {
    const name = event.target.value
    updateTrip((current) => ({ ...current, name }))
  }

  function selectTrip(event) {
    const activeTripId = event.target.value
    setData((current) => ({ ...current, activeTripId }))
  }

  function addTrip() {
    const newTrip = createTrip('Nuevo viaje', [{ name: 'Yo', shares: 1 }])
    setData((current) => ({ ...current, trips: [...current.trips, newTrip], activeTripId: newTrip.id }))
  }

  function removeTrip() {
    if (data.trips.length === 1) return
    if (!window.confirm(`¿Quieres borrar el viaje «${trip.name}» y todos sus gastos?`)) return
    setData((current) => {
      const trips = current.trips.filter((item) => item.id !== trip.id)
      return { ...current, trips, activeTripId: trips[0].id }
    })
  }

  function togglePerson(personId) {
    setForm((current) => ({
      ...current,
      sharedBy: current.sharedBy.includes(personId)
        ? current.sharedBy.filter((id) => id !== personId)
        : [...current.sharedBy, personId],
    }))
  }

  function addExpense(event) {
    event.preventDefault()
    const amount = Number(form.amount.replace(',', '.'))
    if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0 || !form.sharedBy.length) return

    updateTrip((current) => ({
      ...current,
      expenses: [
        {
          id: createId(),
          description: form.description.trim(),
          amount,
          paidBy: form.paidBy,
          sharedBy: form.sharedBy,
        },
        ...current.expenses,
      ],
    }))
    setForm((current) => ({ ...current, description: '', amount: '' }))
  }

  function addPerson(event) {
    event.preventDefault()
    if (!personName.trim()) return
    const id = createId()
    updateTrip((current) => ({
      ...current,
      participants: [
        ...current.participants,
        {
          id,
          name: personName.trim(),
          shares: normalizeShares(personShares.replace(',', '.')),
          color: pickColor(current.participants.length),
        },
      ],
    }))
    setForm((current) => ({ ...current, sharedBy: [...current.sharedBy, id] }))
    setPersonName('')
    setPersonShares('1')
    setShowPersonForm(false)
  }

  function editShares(personId, value) {
    setSharesDrafts((current) => ({ ...current, [personId]: value }))
  }

  function commitShares(personId) {
    const draft = sharesDrafts[personId]
    setSharesDrafts((current) => {
      const next = { ...current }
      delete next[personId]
      return next
    })
    if (draft === undefined) return
    const value = normalizeShares(draft.replace(',', '.'))
    updateTrip((current) => ({
      ...current,
      participants: current.participants.map((participant) =>
        participant.id === personId ? { ...participant, shares: value } : participant,
      ),
    }))
  }

  function removePerson(personId) {
    const person = trip.participants.find((participant) => participant.id === personId)
    if (!person) return
    if (!window.confirm(`¿Quitar a ${person.name}? También se borrarán los gastos que haya pagado.`)) return

    updateTrip((current) => ({
      ...current,
      participants: current.participants.filter((participant) => participant.id !== personId),
      expenses: current.expenses
        .filter((expense) => expense.paidBy !== personId)
        .map((expense) => ({ ...expense, sharedBy: expense.sharedBy.filter((id) => id !== personId) }))
        .filter((expense) => expense.sharedBy.length),
    }))
    setForm((current) => ({
      ...current,
      paidBy: current.paidBy === personId ? (trip.participants.find((item) => item.id !== personId)?.id ?? '') : current.paidBy,
      sharedBy: current.sharedBy.filter((id) => id !== personId),
    }))
  }

  function removeExpense(id) {
    updateTrip((current) => ({ ...current, expenses: current.expenses.filter((expense) => expense.id !== id) }))
  }

  function clearExpenses() {
    if (window.confirm('¿Quieres borrar todos los gastos de este viaje?')) {
      updateTrip((current) => ({ ...current, expenses: [] }))
    }
  }

  async function shareTrip() {
    const link = buildShareLink(trip)
    try {
      await navigator.clipboard.writeText(link)
      setShareStatus('Enlace copiado con los gastos de ahora mismo.')
    } catch {
      window.prompt('Copia este enlace para abrir el viaje en otro dispositivo:', link)
      setShareStatus('')
    }
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span>÷</span> Cuentas separadas</div>
        <div className="topbar-actions">
          <select aria-label="Viaje activo" value={trip.id} onChange={selectTrip}>
            {data.trips.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button className="text-button" type="button" onClick={addTrip}>+ Nuevo viaje</button>
          <button className="text-button" type="button" onClick={removeTrip} disabled={data.trips.length === 1}>Borrar viaje</button>
          <button className="text-button" type="button" onClick={clearExpenses} disabled={!trip.expenses.length}>Reiniciar gastos</button>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">VIAJE COMPARTIDO</p>
        <input className="trip-name" aria-label="Nombre del viaje" value={trip.name} onChange={updateTripName} />
        <p>Apunta los gastos y deja que las cuentas se cuadren solas.</p>
        <div className="share">
          <button className="text-button" type="button" onClick={shareTrip}>🔗 Copiar enlace para compartir</button>
          {shareStatus && <span role="status">{shareStatus}</span>}
          <span className="share-note">Al abrir un enlace los gastos se fusionan con los de este dispositivo; comparte el enlace de nuevo cada vez que apuntes algo para que el resto lo vea.</span>
        </div>
      </section>

      <section className="summary" aria-label="Resumen del viaje">
        <div><span>Gasto total</span><strong>{money.format(total)}</strong></div>
        <div><span>Gastos apuntados</span><strong>{trip.expenses.length}</strong></div>
        <div><span>Participantes</span><strong>{trip.participants.length}</strong></div>
        <div><span>Personas</span><strong>{shares}</strong></div>
      </section>

      <div className="layout">
        <section className="card add-expense">
          <div className="section-heading">
            <div><p className="eyebrow">NUEVO GASTO</p><h2>¿Quién ha pagado?</h2></div>
          </div>
          {trip.participants.length ? (
            <form onSubmit={addExpense}>
              <div className="field-row">
                <label>Concepto<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ej. Cena del martes" required /></label>
                <label className="amount">Importe<input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0,00 €" required /></label>
              </div>
              <label>Ha pagado
                <select value={form.paidBy} onChange={(event) => setForm({ ...form, paidBy: event.target.value })}>
                  {trip.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}
                </select>
              </label>
              <fieldset>
                <legend>Se reparte entre (según el peso de cada participante)</legend>
                <div className="people-picker">
                  {trip.participants.map((participant) => (
                    <label className={`person-choice ${form.sharedBy.includes(participant.id) ? 'selected' : ''}`} key={participant.id}>
                      <input type="checkbox" checked={form.sharedBy.includes(participant.id)} onChange={() => togglePerson(participant.id)} />
                      <i style={{ backgroundColor: participant.color }}>{participant.name.slice(0, 1)}</i>{participant.name} ×{participant.shares}
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className="primary" type="submit">Añadir gasto <span>→</span></button>
            </form>
          ) : <p className="hint">Añade primero algún participante para poder apuntar gastos.</p>}
        </section>

        <section className="card balances">
          <p className="eyebrow">BALANCE ACTUAL</p><h2>Así van las cuentas</h2>
          <div className="balance-list">
            {trip.participants.map((participant) => {
              const balance = balances[participant.id] ?? 0
              const { paid = 0, owed = 0 } = spending[participant.id] ?? {}
              return <div className="balance-row" key={participant.id}>
                <span className="avatar" style={{ backgroundColor: participant.color }}>{participant.name.slice(0, 1)}</span>
                <span className="balance-person">{participant.name}<small>{percent.format(shares ? participant.shares / shares : 0)} del reparto{participant.shares > 1 ? ` · cuenta como ${participant.shares}` : ''}</small></span>
                <label className="shares">
                  <span className="visually-hidden">Peso de {participant.name}</span>
                  <input inputMode="decimal" value={sharesDrafts[participant.id] ?? String(participant.shares)} onChange={(event) => editShares(participant.id, event.target.value)} onBlur={() => commitShares(participant.id)} aria-label={`Peso de ${participant.name}`} />
                </label>
                <strong className={balance >= 0 ? 'positive' : 'negative'}>{balance >= 0 ? '+' : '−'}{money.format(Math.abs(balance))}</strong>
                <button type="button" className="remove-person" onClick={() => removePerson(participant.id)} aria-label={`Quitar a ${participant.name}`}>×</button>
                <p className="balance-detail">
                  Ha pagado <b>{money.format(paid)}</b> · le corresponde <b>{money.format(owed)}</b>
                  {participant.shares > 1 ? ` (${money.format(owed / participant.shares)} por persona)` : ''}
                </p>
              </div>
            })}
          </div>
          <button className="add-person" type="button" onClick={() => setShowPersonForm(!showPersonForm)}>+ Añadir participante</button>
          {showPersonForm && <form className="person-form" onSubmit={addPerson}>
            <input autoFocus value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="Nombre o cuenta conjunta" />
            <input className="shares-input" inputMode="decimal" value={personShares} onChange={(event) => setPersonShares(event.target.value)} aria-label="Peso del participante" />
            <button type="submit">Añadir</button>
          </form>}
          <p className="hint">El peso indica cuántas partes paga cada participante: una cuenta conjunta de dos personas usa peso 2, así que asume el doble de cada gasto compartido. Lo que paga se le abona entero a quien adelanta el dinero.</p>
        </section>
      </div>

      <section className="settlement card">
        <div><p className="eyebrow">AL FINAL DEL VIAJE</p><h2>Para saldar las cuentas</h2></div>
        {settlements.length ? <div className="payments">
          {settlements.map((payment, index) => <p key={`${payment.from}-${payment.to}-${index}`}><b>{payment.from}</b> paga <strong>{money.format(payment.amount)}</strong> a <b>{payment.to}</b></p>)}
        </div> : <p className="settled">Todo está cuadrado. ¡Buen viaje! ✨</p>}
      </section>

      <section className="expenses">
        <div className="section-heading"><div><p className="eyebrow">HISTORIAL</p><h2>Gastos del viaje</h2></div><span>{trip.expenses.length} {trip.expenses.length === 1 ? 'gasto' : 'gastos'}</span></div>
        {trip.expenses.length ? <div className="expense-list">
          {trip.expenses.map((expense) => {
            const payer = trip.participants.find((participant) => participant.id === expense.paidBy)
            const expenseShares = totalShares(trip.participants.filter((participant) => expense.sharedBy.includes(participant.id)))
            return <article className="expense" key={expense.id}>
              <span className="avatar" style={{ backgroundColor: payer?.color }}>{payer?.name.slice(0, 1)}</span>
              <div><h3>{expense.description}</h3><p>Pagó {payer?.name} · entre {expense.sharedBy.length} {expense.sharedBy.length === 1 ? 'participante' : 'participantes'} ({expenseShares} {expenseShares === 1 ? 'persona' : 'personas'})</p></div>
              <strong>{money.format(expense.amount)}</strong>
              <button type="button" onClick={() => removeExpense(expense.id)} aria-label={`Eliminar ${expense.description}`}>×</button>
            </article>
          })}
        </div> : <div className="empty"><span>⌁</span><p>Aún no hay gastos. Añade el primero para empezar a hacer cuentas.</p></div>}
      </section>
    </main>
  )
}

export default App
