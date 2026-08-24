export const DATA_VERSION = 2

const palette = ['#7567f8', '#ef7d5b', '#21a58b', '#df5d92', '#3295d8', '#be8a31', '#8a68ce']

export function pickColor(index) {
  return palette[index % palette.length]
}

export function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

export function createTrip(name = 'Nuevo viaje', participants = []) {
  return {
    id: createId(),
    name,
    createdAt: new Date().toISOString(),
    participants: participants.map((participant, index) => ({
      id: createId(),
      shares: 1,
      color: pickColor(index),
      ...participant,
    })),
    expenses: [],
  }
}

export function createInitialData() {
  const trip = createTrip('Gastos del viaje', [
    { name: 'Araceli y Santi', shares: 2 },
    { name: 'Albert', shares: 1 },
    { name: 'Naomi', shares: 1 },
  ])
  return { version: DATA_VERSION, trips: [trip], activeTripId: trip.id }
}

export function normalizeShares(value) {
  const shares = Number(value)
  if (!Number.isFinite(shares) || shares <= 0) return 1
  return Math.round(shares * 100) / 100
}

export function normalizeTrip(trip, index = 0) {
  if (!trip || typeof trip !== 'object') return null
  const participants = (Array.isArray(trip.participants) ? trip.participants : trip.people || [])
    .filter((participant) => participant && typeof participant === 'object')
    .map((participant, participantIndex) => ({
      id: String(participant.id ?? createId()),
      name: String(participant.name ?? 'Participante').slice(0, 80),
      color: typeof participant.color === 'string' ? participant.color : pickColor(participantIndex),
      shares: normalizeShares(participant.shares ?? 1),
    }))
  const participantIds = new Set(participants.map((participant) => participant.id))
  const expenses = (Array.isArray(trip.expenses) ? trip.expenses : [])
    .filter((expense) => expense && typeof expense === 'object')
    .map((expense) => ({
      id: String(expense.id ?? createId()),
      description: String(expense.description ?? '').slice(0, 120),
      amount: Number(expense.amount) || 0,
      paidBy: String(expense.paidBy ?? ''),
      sharedBy: (Array.isArray(expense.sharedBy) ? expense.sharedBy : [])
        .map(String)
        .filter((id) => participantIds.has(id)),
    }))
    .filter((expense) => expense.amount > 0 && participantIds.has(expense.paidBy) && expense.sharedBy.length)

  return {
    id: String(trip.id ?? createId()),
    name: String(trip.name ?? trip.tripName ?? `Viaje ${index + 1}`).slice(0, 80),
    createdAt: typeof trip.createdAt === 'string' ? trip.createdAt : new Date().toISOString(),
    participants,
    expenses,
  }
}

export function normalizeData(raw) {
  if (!raw || typeof raw !== 'object') return createInitialData()

  const legacy = !Array.isArray(raw.trips) && (raw.people || raw.tripName) ? [raw] : null
  const trips = (legacy ?? (Array.isArray(raw.trips) ? raw.trips : []))
    .map(normalizeTrip)
    .filter(Boolean)

  if (!trips.length) return createInitialData()

  const activeTripId = trips.some((trip) => trip.id === raw.activeTripId) ? raw.activeTripId : trips[0].id
  return { version: DATA_VERSION, trips, activeTripId }
}

export function totalShares(participants) {
  return participants.reduce((sum, participant) => sum + participant.shares, 0)
}

export function computeBalances(trip) {
  const balances = Object.fromEntries(trip.participants.map((participant) => [participant.id, 0]))
  const sharesById = Object.fromEntries(trip.participants.map((participant) => [participant.id, participant.shares]))

  trip.expenses.forEach((expense) => {
    const expenseShares = expense.sharedBy.reduce((sum, id) => sum + (sharesById[id] ?? 0), 0)
    if (!expenseShares) return
    balances[expense.paidBy] += expense.amount
    expense.sharedBy.forEach((id) => {
      balances[id] -= (expense.amount * (sharesById[id] ?? 0)) / expenseShares
    })
  })
  return balances
}

export function computeSpending(trip) {
  const spending = Object.fromEntries(
    trip.participants.map((participant) => [participant.id, { paid: 0, owed: 0 }]),
  )
  const sharesById = Object.fromEntries(trip.participants.map((participant) => [participant.id, participant.shares]))

  trip.expenses.forEach((expense) => {
    const expenseShares = expense.sharedBy.reduce((sum, id) => sum + (sharesById[id] ?? 0), 0)
    if (!expenseShares) return
    if (spending[expense.paidBy]) spending[expense.paidBy].paid += expense.amount
    expense.sharedBy.forEach((id) => {
      if (!spending[id]) return
      spending[id].owed += (expense.amount * (sharesById[id] ?? 0)) / expenseShares
    })
  })
  return spending
}

export function mergeTrips(local, incoming) {
  if (!local) return incoming
  if (!incoming) return local

  const participants = [...local.participants]
  incoming.participants.forEach((participant) => {
    const index = participants.findIndex((item) => item.id === participant.id)
    if (index === -1) participants.push(participant)
    else participants[index] = { ...participants[index], name: participant.name, shares: participant.shares }
  })

  const participantIds = new Set(participants.map((participant) => participant.id))
  const expenses = [...local.expenses]
  incoming.expenses.forEach((expense) => {
    const index = expenses.findIndex((item) => item.id === expense.id)
    if (index === -1) expenses.push(expense)
    else expenses[index] = expense
  })

  return {
    ...local,
    name: incoming.name || local.name,
    participants,
    expenses: expenses
      .map((expense) => ({ ...expense, sharedBy: expense.sharedBy.filter((id) => participantIds.has(id)) }))
      .filter((expense) => participantIds.has(expense.paidBy) && expense.sharedBy.length),
  }
}

export function computeSettlements(trip, balances) {
  const creditors = trip.participants
    .map((participant) => ({ ...participant, amount: balances[participant.id] ?? 0 }))
    .filter((participant) => participant.amount > 0.005)
  const debtors = trip.participants
    .map((participant) => ({ ...participant, amount: -(balances[participant.id] ?? 0) }))
    .filter((participant) => participant.amount > 0.005)

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
}
