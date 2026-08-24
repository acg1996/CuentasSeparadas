import { normalizeData, createInitialData, normalizeTrip } from './trips.js'

const storageKey = 'cuentas-separadas-data'
const shareParam = 'viaje'

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function loadData() {
  try {
    const saved = localStorage.getItem(storageKey)
    return saved ? normalizeData(JSON.parse(saved)) : createInitialData()
  } catch {
    return createInitialData()
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data))
  } catch {
    // El almacenamiento local puede estar lleno o deshabilitado; los datos siguen en memoria.
  }
}

export function readSharedTrip() {
  try {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const encoded = new URLSearchParams(hash).get(shareParam)
    if (!encoded) return null
    return normalizeTrip(JSON.parse(fromBase64Url(encoded)))
  } catch {
    return null
  }
}

export function clearSharedTrip() {
  const { origin, pathname, search } = window.location
  window.history.replaceState(null, '', `${origin}${pathname}${search}`)
}

export function buildShareLink(trip) {
  const { origin, pathname, search } = window.location
  const encoded = toBase64Url(JSON.stringify(trip))
  return `${origin}${pathname}${search}#${shareParam}=${encoded}`
}
