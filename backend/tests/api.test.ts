import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { TEST_JWT_SECRET } from './test-env'

type Role = 'PARTICIPANT' | 'ORGANIZER' | 'ADMIN'

const password = 'Password123!'
let userSequence = 0

async function cleanDatabase() {
  await prisma.organizerRequest.deleteMany()
  await prisma.registration.deleteMany()
  await prisma.tripActivity.deleteMany()
  await prisma.trip.deleteMany()
  await prisma.destination.deleteMany()
  await prisma.user.deleteMany()
}

async function createUser(role: Role = 'PARTICIPANT', email?: string) {
  userSequence += 1

  return prisma.user.create({
    data: {
      firstName: 'Test',
      lastName: role,
      email: email ?? `${role.toLowerCase()}-${userSequence}@example.com`,
      passwordHash: await bcrypt.hash(password, 4),
      role,
    },
  })
}

function authToken(user: { id: string; role: Role }) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  )
}

async function createDestination(name = 'Barcelona') {
  return prisma.destination.create({
    data: {
      name,
      country: 'Spain',
      latitude: 41.3874,
      longitude: 2.1686,
      externalPlaceId: `test:${name}`,
    },
  })
}

async function createTrip(
  organizerId: string,
  destinationId: string,
  overrides: Record<string, unknown> = {}
) {
  const startDate = new Date()
  startDate.setUTCDate(startDate.getUTCDate() + 30)
  startDate.setUTCHours(0, 0, 0, 0)

  const endDate = new Date(startDate)
  endDate.setUTCDate(endDate.getUTCDate() + 2)

  return prisma.trip.create({
    data: {
      organizerId,
      destinationId,
      title: 'Test Adventure',
      description: 'A detailed test adventure description.',
      category: 'City Break',
      difficulty: 'Easy',
      startDate,
      endDate,
      maxParticipants: 4,
      meetingPoint: 'Main square',
      status: 'PUBLISHED',
      ...overrides,
    },
  })
}

beforeEach(cleanDatabase)
afterAll(async () => prisma.$disconnect())

describe('health and authentication', () => {
  it('reports service health', async () => {
    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
  })

  it('registers a participant', async () => {
    const response = await request(app).post('/api/auth/register').send({
      firstName: 'New',
      lastName: 'User',
      email: 'new@example.com',
      password,
    })

    expect(response.status).toBe(201)
    expect(response.body.user).toMatchObject({
      email: 'new@example.com',
      role: 'PARTICIPANT',
    })
  })

  it('rejects invalid registration data', async () => {
    const response = await request(app).post('/api/auth/register').send({
      firstName: 'X',
      lastName: 'Y',
      email: 'not-an-email',
      password: 'short',
    })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Invalid registration data.')
  })

  it('rejects duplicate email addresses', async () => {
    await createUser('PARTICIPANT', 'duplicate@example.com')

    const response = await request(app).post('/api/auth/register').send({
      firstName: 'Another',
      lastName: 'User',
      email: 'duplicate@example.com',
      password,
    })

    expect(response.status).toBe(409)
  })

  it('logs in and returns the current user', async () => {
    await createUser('PARTICIPANT', 'login@example.com')

    const login = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password,
    })

    expect(login.status).toBe(200)
    expect(login.body.token).toBeTruthy()

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`)

    expect(me.status).toBe(200)
    expect(me.body.user.email).toBe('login@example.com')
  })

  it('rejects an invalid password', async () => {
    await createUser('PARTICIPANT', 'wrong@example.com')

    const response = await request(app).post('/api/auth/login').send({
      email: 'wrong@example.com',
      password: 'WrongPassword123!',
    })

    expect(response.status).toBe(401)
  })
})

describe('trip search', () => {
  it('returns only published trips', async () => {
    const organizer = await createUser('ORGANIZER')
    const destination = await createDestination()
    await createTrip(organizer.id, destination.id)
    await createTrip(organizer.id, destination.id, {
      title: 'Hidden Draft',
      status: 'DRAFT',
    })

    const response = await request(app).get('/api/trips')

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].title).toBe('Test Adventure')
  })

  it('combines search, category, difficulty and date filters', async () => {
    const organizer = await createUser('ORGANIZER')
    const destination = await createDestination()
    const trip = await createTrip(organizer.id, destination.id)

    const matching = await request(app).get('/api/trips').query({
      search: 'Barcelona',
      category: 'city break',
      difficulty: 'easy',
      startDate: trip.startDate.toISOString().slice(0, 10),
      endDate: trip.endDate.toISOString().slice(0, 10),
    })

    expect(matching.status).toBe(200)
    expect(matching.body.data).toHaveLength(1)

    const nonMatching = await request(app)
      .get('/api/trips')
      .query({ category: 'Hiking' })

    expect(nonMatching.body.data).toHaveLength(0)
  })
})

describe('itinerary validation', () => {
  it('warns about duplicate start times', async () => {
    const organizer = await createUser('ORGANIZER')
    const destination = await createDestination()
    const trip = await createTrip(organizer.id, destination.id)

    await prisma.tripActivity.createMany({
      data: [
        {
          tripId: trip.id,
          title: 'Museum',
          activityDate: trip.startDate,
          startTime: new Date('1970-01-01T10:00:00.000Z'),
          locationName: 'Museum',
          sortOrder: 1,
        },
        {
          tripId: trip.id,
          title: 'Lunch',
          activityDate: trip.startDate,
          startTime: new Date('1970-01-01T10:00:00.000Z'),
          locationName: 'Cafe',
          sortOrder: 2,
        },
      ],
    })

    const response = await request(app)
      .get(`/api/trips/${trip.id}/activities/warnings`)
      .set('Authorization', `Bearer ${authToken(organizer)}`)

    expect(response.status).toBe(200)
    expect(response.body.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATE_TIME' }),
      ])
    )
  })

  it('rejects an activity outside the trip dates', async () => {
    const organizer = await createUser('ORGANIZER')
    const destination = await createDestination()
    const trip = await createTrip(organizer.id, destination.id, {
      status: 'DRAFT',
    })
    const outside = new Date(trip.endDate)
    outside.setUTCDate(outside.getUTCDate() + 2)

    const response = await request(app)
      .post(`/api/trips/${trip.id}/activities`)
      .set('Authorization', `Bearer ${authToken(organizer)}`)
      .send({
        title: 'Too late',
        activityDate: outside.toISOString().slice(0, 10),
        locationName: 'Somewhere',
        sortOrder: 1,
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe(
      'Activity date must be within the trip dates.'
    )
  })
})

describe('trip registration and capacity', () => {
  it('joins, cancels and rejoins a published trip', async () => {
    const organizer = await createUser('ORGANIZER')
    const participant = await createUser('PARTICIPANT')
    const destination = await createDestination()
    const trip = await createTrip(organizer.id, destination.id)

    const join = await request(app)
      .post(`/api/trips/${trip.id}/registrations`)
      .set('Authorization', `Bearer ${authToken(participant)}`)

    expect(join.status).toBe(201)
    expect(join.body.data.status).toBe('PENDING')

    const duplicate = await request(app)
      .post(`/api/trips/${trip.id}/registrations`)
      .set('Authorization', `Bearer ${authToken(participant)}`)

    expect(duplicate.status).toBe(409)

    const cancel = await request(app)
      .patch(`/api/trips/${trip.id}/registrations/cancel`)
      .set('Authorization', `Bearer ${authToken(participant)}`)

    expect(cancel.status).toBe(200)
    expect(cancel.body.data.status).toBe('CANCELLED')

    const rejoin = await request(app)
      .post(`/api/trips/${trip.id}/registrations`)
      .set('Authorization', `Bearer ${authToken(participant)}`)

    expect(rejoin.status).toBe(201)
    expect(rejoin.body.data.status).toBe('PENDING')
  })

  it('prevents accepting more participants than capacity', async () => {
    const organizer = await createUser('ORGANIZER')
    const first = await createUser('PARTICIPANT')
    const second = await createUser('PARTICIPANT')
    const destination = await createDestination()
    const trip = await createTrip(organizer.id, destination.id, {
      maxParticipants: 1,
    })

    for (const user of [first, second]) {
      const response = await request(app)
        .post(`/api/trips/${trip.id}/registrations`)
        .set('Authorization', `Bearer ${authToken(user)}`)

      expect(response.status).toBe(201)
    }

    const registrations = await prisma.registration.findMany({
      where: { tripId: trip.id },
      orderBy: { registeredAt: 'asc' },
    })

    const firstAccept = await request(app)
      .patch(
        `/api/trips/${trip.id}/registrations/${registrations[0].id}/status`
      )
      .set('Authorization', `Bearer ${authToken(organizer)}`)
      .send({ status: 'ACCEPTED' })

    expect(firstAccept.status).toBe(200)

    const secondAccept = await request(app)
      .patch(
        `/api/trips/${trip.id}/registrations/${registrations[1].id}/status`
      )
      .set('Authorization', `Bearer ${authToken(organizer)}`)
      .send({ status: 'ACCEPTED' })

    expect(secondAccept.status).toBe(409)
    expect(secondAccept.body.message).toBe('This trip is fully booked.')
  })

  it('prevents an organizer from managing another organizer trip', async () => {
    const owner = await createUser('ORGANIZER')
    const other = await createUser('ORGANIZER')
    const destination = await createDestination()
    const trip = await createTrip(owner.id, destination.id)

    const response = await request(app)
      .get(`/api/trips/${trip.id}/registrations`)
      .set('Authorization', `Bearer ${authToken(other)}`)

    expect(response.status).toBe(403)
  })
})

describe('admin approval', () => {
  it('publishes a pending trip when approved', async () => {
    const organizer = await createUser('ORGANIZER')
    const admin = await createUser('ADMIN')
    const destination = await createDestination()
    const trip = await createTrip(organizer.id, destination.id, {
      status: 'PENDING',
    })

    const response = await request(app)
      .patch(`/api/admin/trips/${trip.id}/review`)
      .set('Authorization', `Bearer ${authToken(admin)}`)
      .send({ decision: 'APPROVE' })

    expect(response.status).toBe(200)

    const updated = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
    })

    expect(updated.status).toBe('PUBLISHED')
  })

  it('blocks non-admin users from approving trips', async () => {
    const organizer = await createUser('ORGANIZER')
    const destination = await createDestination()
    const trip = await createTrip(organizer.id, destination.id, {
      status: 'PENDING',
    })

    const response = await request(app)
      .patch(`/api/admin/trips/${trip.id}/review`)
      .set('Authorization', `Bearer ${authToken(organizer)}`)
      .send({ decision: 'APPROVE' })

    expect(response.status).toBe(403)
  })

  it('requires a reason when rejecting a trip', async () => {
    const organizer = await createUser('ORGANIZER')
    const admin = await createUser('ADMIN')
    const destination = await createDestination()
    const trip = await createTrip(organizer.id, destination.id, {
      status: 'PENDING',
    })

    const response = await request(app)
      .patch(`/api/admin/trips/${trip.id}/review`)
      .set('Authorization', `Bearer ${authToken(admin)}`)
      .send({ decision: 'REJECT' })

    expect(response.status).toBe(400)
  })
})
