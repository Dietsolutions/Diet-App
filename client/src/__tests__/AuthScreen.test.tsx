import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthScreen } from '../components/AuthScreen';

vi.mock('axios');
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    login: vi.fn().mockRejectedValue(new Error('mock')),
    signup: vi.fn().mockRejectedValue(new Error('mock')),
  })),
}));
vi.mock('../lib/api', () => ({
  apiUrl: vi.fn((p: string) => p),
}));
vi.mock('../lib/capacitor', () => ({
  isNative: false,
  platform: vi.fn(() => 'web'),
  signInWithApple: vi.fn(),
}));
vi.mock('../lib/analytics', () => ({
  identifyUser: vi.fn(),
  resetUser: vi.fn(),
}));

describe('AuthScreen', () => {

  it('renders signup form by default', () => {
    render(<AuthScreen />);
    expect(screen.getByText('SIGN UP')).toBeInTheDocument();
    expect(screen.getByText('CONFIRM PASSWORD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByText(/Medical Disclaimer/)).toBeInTheDocument();
  });

  it('switches to login mode', async () => {
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole('button', { name: /^login$/i }));
    await waitFor(() => {
      expect(screen.queryByText('CONFIRM PASSWORD')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log In' })).toBeInTheDocument();
  });

  it('shows error on empty login submission', async () => {
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole('button', { name: /^login$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    await waitFor(() => {
      expect(screen.getByText('Please enter your username and password')).toBeInTheDocument();
    });
  });
});
