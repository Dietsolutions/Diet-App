import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../store/authStore';

const mockUser = { id: '1', username: 'alice', email: null, name: null, avatar: null, onboardingDone: false };

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: true });
  });

  it('starts with null user and loading true', () => {
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.isLoading).toBe(true);
  });

  it('setUser sets the user', () => {
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('setUser(null) clears the user (logout)', () => {
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('setLoading updates isLoading', () => {
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
  });

  it('isAuthenticated derived from user !== null', () => {
    expect(useAuthStore.getState().user !== null).toBe(false);
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user !== null).toBe(true);
  });

  it('login -> setUser -> isAuthenticated flow', () => {
    // Simulate login: setUser is called with user data
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().user !== null).toBe(true);
  });

  it('logout -> setUser(null) -> isAuthenticated false flow', () => {
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().user !== null).toBe(false);
  });
});
