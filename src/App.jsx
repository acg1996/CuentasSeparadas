import { useEffect, useMemo, useState } from 'react'
import './App.css'

const initialData = {
  tripName: 'Gastos del viaje',
  people: [
    { id: 'parents', name: 'Araceli y Santi', color: '#7567f8' },
    { id: 'albert', name: 'Albert', color: '#ef7d5b' },
    { id: 'naomi', name: 'Naomi', color: '#21a58b' },
  ],
  expenses: [],
}

const storageKey = 'cuentas-separadas-data'
const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

function loadData() {
  try {
    const saved = localStorage.getItem(storageKey)
    return saved ? JSON.parse(saved) : initialData
  } catch {
    return initialData
  }
}

function App() {
  const [data, setData] = useState(loadData)
  const [showPersonForm, setShowPersonForm] = useState(false)
  const [personName, setPersonName] = useState('')
  const [form, setForm] = useState(() => ({
    description: '',
    amount: '',
    paidBy: initialData.people[0].id,
    sharedBy: initialData.people.map((person) => person.id),
  }))

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(data))
  }, [data])

  const balances = useMemo(() => {
    const result = Object.fromEntries(data.people.map((person) => [person.id, 0]))
    data.expenses.forEach((expense) => {
      result[expense.paidBy] += expense.amount
      const share = expense.amount / expense.sharedBy.length
      expense.sharedBy.forEach((personId) => {
        result[personId] -= share
      })
    })
    return result
  }, [data])

  const settlements = useMemo(() => {
    const creditors = data.people
      .map((person) => ({ ...person, amount: balances[person.id] }))
      .filter((person) => person.amount > 0.005)
    const debtors = data.people
      .map((person) => ({ ...person, amount: -balances[person.id] }))
      .filter((person) => person.amount > 0.005)
    const payments = []
    let creditorIndex = 0
    let debtorIndex = 0

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex]
      const debtor = debtors[debtorIndex]
      const amount = Math.min(creditor.amount, debtor.amount)
      payments.push({ from: debtor.name, to: creditor.name, amount })
      creditor.amount -= amount
      debtor.amount -= amount
      if (creditor.amount < 0.005) creditorIndex += 1
      if (debtor.amount < 0.005) debtorIndex += 1
    }
    return payments
  }, [balances, data.people])

  const total = data.expenses.reduce((sum, expense) => sum + expense.amount, 0)

  function updateTripName(event) {
    setData((current) => ({ ...current, tripName: event.target.value }))
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

    setData((current) => ({
      ...current,
      expenses: [
        {
          id: crypto.randomUUID(),
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
    const id = crypto.randomUUID()
    const colors = ['#df5d92', '#3295d8', '#be8a31', '#8a68ce']
    const person = { id, name: personName.trim(), color: colors[data.people.length % colors.length] }
    setData((current) => ({ ...current, people: [...current.people, person] }))
    setForm((current) => ({ ...current, sharedBy: [...current.sharedBy, id] }))
    setPersonName('')
    setShowPersonForm(false)
  }

  function removeExpense(id) {
    setData((current) => ({ ...current, expenses: current.expenses.filter((expense) => expense.id !== id) }))
  }

  function clearTrip() {
    if (window.confirm('¿Quieres borrar todos los gastos de este viaje?')) {
      setData((current) => ({ ...current, expenses: [] }))
    }
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span>÷</span> Cuentas separadas</div>
        <button className="text-button" type="button" onClick={clearTrip} disabled={!data.expenses.length}>Reiniciar viaje</button>
      </header>

      <section className="hero">
        <p className="eyebrow">VIAJE COMPARTIDO</p>
        <input className="trip-name" aria-label="Nombre del viaje" value={data.tripName} onChange={updateTripName} />
        <p>Apunta los gastos y deja que las cuentas se cuadren solas.</p>
      </section>

      <section className="summary" aria-label="Resumen del viaje">
        <div><span>Gasto total</span><strong>{money.format(total)}</strong></div>
        <div><span>Gastos apuntados</span><strong>{data.expenses.length}</strong></div>
        <div><span>Participantes</span><strong>{data.people.length}</strong></div>
      </section>

      <div className="layout">
        <section className="card add-expense">
          <div className="section-heading">
            <div><p className="eyebrow">NUEVO GASTO</p><h2>¿Quién ha pagado?</h2></div>
          </div>
          <form onSubmit={addExpense}>
            <div className="field-row">
              <label>Concepto<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ej. Cena del martes" required /></label>
              <label className="amount">Importe<input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0,00 €" required /></label>
            </div>
            <label>Ha pagado
              <select value={form.paidBy} onChange={(event) => setForm({ ...form, paidBy: event.target.value })}>
                {data.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
            <fieldset>
              <legend>Se reparte entre</legend>
              <div className="people-picker">
                {data.people.map((person) => (
                  <label className={`person-choice ${form.sharedBy.includes(person.id) ? 'selected' : ''}`} key={person.id}>
                    <input type="checkbox" checked={form.sharedBy.includes(person.id)} onChange={() => togglePerson(person.id)} />
                    <i style={{ backgroundColor: person.color }}>{person.name.slice(0, 1)}</i>{person.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="primary" type="submit">Añadir gasto <span>→</span></button>
          </form>
        </section>

        <section className="card balances">
          <p className="eyebrow">BALANCE ACTUAL</p><h2>Así van las cuentas</h2>
          <div className="balance-list">
            {data.people.map((person) => {
              const balance = balances[person.id]
              return <div className="balance-row" key={person.id}>
                <span className="avatar" style={{ backgroundColor: person.color }}>{person.name.slice(0, 1)}</span>
                <span>{person.name}</span>
                <strong className={balance >= 0 ? 'positive' : 'negative'}>{balance >= 0 ? '+' : '−'}{money.format(Math.abs(balance))}</strong>
              </div>
            })}
          </div>
          <button className="add-person" type="button" onClick={() => setShowPersonForm(!showPersonForm)}>+ Añadir participante</button>
          {showPersonForm && <form className="person-form" onSubmit={addPerson}>
            <input autoFocus value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="Nombre o cuenta conjunta" />
            <button type="submit">Añadir</button>
          </form>}
        </section>
      </div>

      <section className="settlement card">
        <div><p className="eyebrow">AL FINAL DEL VIAJE</p><h2>Para saldar las cuentas</h2></div>
        {settlements.length ? <div className="payments">
          {settlements.map((payment, index) => <p key={`${payment.from}-${payment.to}-${index}`}><b>{payment.from}</b> paga <strong>{money.format(payment.amount)}</strong> a <b>{payment.to}</b></p>)}
        </div> : <p className="settled">Todo está cuadrado. ¡Buen viaje! ✨</p>}
      </section>

      <section className="expenses">
        <div className="section-heading"><div><p className="eyebrow">HISTORIAL</p><h2>Gastos del viaje</h2></div><span>{data.expenses.length} {data.expenses.length === 1 ? 'gasto' : 'gastos'}</span></div>
        {data.expenses.length ? <div className="expense-list">
          {data.expenses.map((expense) => {
            const payer = data.people.find((person) => person.id === expense.paidBy)
            return <article className="expense" key={expense.id}>
              <span className="avatar" style={{ backgroundColor: payer?.color }}>{payer?.name.slice(0, 1)}</span>
              <div><h3>{expense.description}</h3><p>Pagó {payer?.name} · entre {expense.sharedBy.length} {expense.sharedBy.length === 1 ? 'persona' : 'personas'}</p></div>
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
