import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProtectedRoute from '../src/components/ProtectedRoute'
import type { AuthUser } from '../src/services/api'

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: useAuthMock,
}))

function renderRoute(user: AuthUser | null, allowedRoles?: AuthUser['role'][]) {
  return render(
    <MemoryRouter initialEntries={['/organizer']}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route
          path="/organizer"
          element={
            <ProtectedRoute allowedRoles={allowedRoles}>
              <div>Protected content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    user: null,
    loading: false,
  })
})

describe('ProtectedRoute', () => {
  it('shows a loading state while auth is restoring', () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: true,
    })

    renderRoute(null, ['ORGANIZER'])

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('redirects unauthenticated users to login', () => {
    renderRoute(null, ['ORGANIZER'])

    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('blocks users without the required role', () => {
    const participant: AuthUser = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      role: 'PARTICIPANT',
    }
    useAuthMock.mockReturnValue({
      user: participant,
      loading: false,
    })

    renderRoute(participant, ['ORGANIZER'])

    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })

  it('renders content for an allowed role', () => {
    const organizer: AuthUser = {
      id: 'user-2',
      firstName: 'Test',
      lastName: 'Organizer',
      email: 'organizer@example.com',
      role: 'ORGANIZER',
    }
    useAuthMock.mockReturnValue({
      user: organizer,
      loading: false,
    })

    renderRoute(organizer, ['ORGANIZER'])

    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })
})
