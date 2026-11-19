import { describe, expect, it, vi } from 'vitest'
import {
  getAdminStats,
  getMyTrips,
  getTripById,
  getTrips,
  joinTrip,
  login,
  register,
} from '../src/services/api'

function mockFetch(data: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => data,
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('API client', () => {
  it('builds trip filter query parameters', async () => {
    const fetchMock = mockFetch({
      data: [],
      pagination: { page: 1, limit: 9, total: 0, totalPages: 0 },
    })

    await getTrips({
      search: 'Bled',
      category: 'Nature',
      difficulty: 'Easy',
      page: 2,
    })

    const url = String(fetchMock.mock.calls[0][0])

    expect(url).toContain('/api/trips?')
    expect(url).toContain('search=Bled')
    expect(url).toContain('category=Nature')
    expect(url).toContain('difficulty=Easy')
    expect(url).toContain('page=2')
  })

  it('returns trip data from the API', async () => {
    mockFetch({
      data: [{ id: 'trip-1', title: 'Bled' }],
      pagination: { page: 1, limit: 9, total: 1, totalPages: 1 },
    })

    const response = await getTrips()

    expect(response.data[0].title).toBe('Bled')
    expect(response.pagination.total).toBe(1)
  })

  it('throws the backend error message', async () => {
    mockFetch({ message: 'Invalid filters.' }, false, 400)

    await expect(getTrips()).rejects.toThrow('Invalid filters.')
  })

  it('encodes trip IDs in detail requests', async () => {
    const fetchMock = mockFetch({ data: { id: 'trip/1' } })

    await getTripById('trip/1')

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/api/trips/trip%2F1'
    )
  })

  it('posts login credentials as JSON', async () => {
    const fetchMock = mockFetch({
      message: 'Login successful.',
      token: 'token',
      user: { id: 'user-1' },
    })

    await login({
      email: 'user@example.com',
      password: 'Password123!',
    })

    const [, options] = fetchMock.mock.calls[0]

    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({
      email: 'user@example.com',
      password: 'Password123!',
    })
  })

  it('requires a token for organizer trips', async () => {
    await expect(getMyTrips()).rejects.toThrow('Please log in')
  })

  it('sends the stored token when loading organizer trips', async () => {
    sessionStorage.setItem('tripharbor_token', 'stored-token')
    const fetchMock = mockFetch({ data: [] })

    await getMyTrips()

    const [, options] = fetchMock.mock.calls[0]

    expect(options.headers.Authorization).toBe('Bearer stored-token')
  })

  it('joins a trip with an authenticated POST', async () => {
    sessionStorage.setItem('tripharbor_token', 'stored-token')
    const fetchMock = mockFetch({
      message: 'Registration submitted successfully.',
      data: { id: 'registration-1', status: 'PENDING' },
    })

    await joinTrip('trip-1')

    const [url, options] = fetchMock.mock.calls[0]

    expect(String(url)).toContain('/api/trips/trip-1/registrations')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer stored-token')
  })

  it('registers a user without authentication', async () => {
    const fetchMock = mockFetch({
      message: 'Account created successfully.',
      user: { id: 'user-1' },
    })

    await register({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'Password123!',
    })

    const [, options] = fetchMock.mock.calls[0]

    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body).email).toBe('test@example.com')
    expect(options.headers.Authorization).toBeUndefined()
  })

  it('loads admin statistics with the current token', async () => {
    sessionStorage.setItem('tripharbor_token', 'admin-token')
    const fetchMock = mockFetch({ data: { users: { total: 1 } } })

    await getAdminStats()

    const [url, options] = fetchMock.mock.calls[0]

    expect(String(url)).toContain('/api/admin/stats')
    expect(options.headers.Authorization).toBe('Bearer admin-token')
  })
})
