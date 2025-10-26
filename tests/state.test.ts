import Redis from 'ioredis-mock';
import { setUserState, getUserState, clearUserState, STATE_TTL, UserState } from '../src/state';
import { Theme, Style } from '../src/types';

// Mock ioredis with ioredis-mock
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    // ioredis-mock constructor can be called with initial data
    return new Redis();
  });
});

const mockTheme: Theme = { id: 't1', name: 'Theme 1', defaultText: 'Default', prompt: '...', thumbnail: 'http://example.com/t1.png' };
const mockStyle: Style = { id: 's1', name: 'Style 1', prompt: '...', thumbnail: 'http://example.com/s1.png' };

describe('State Management', () => {

  // No need for beforeEach to clear state, as the mock is fresh for each test run with jest.resetModules()
  beforeEach(() => {
    // Reset modules to ensure a fresh mock redis instance for each test
    jest.resetModules();
  });

  it('should set and get user state', async () => {
    const state: UserState = { theme: mockTheme, style: mockStyle, timestamp: Date.now() };
    await setUserState('test-user', state);
    const retrievedState = await getUserState('test-user');
    // Timestamps might be slightly different, so we compare the core properties
    expect(retrievedState).toBeDefined();
    expect(retrievedState).toEqual(expect.objectContaining({ theme: mockTheme, style: mockStyle }));
  });

  it('should return undefined for a non-existent user', async () => {
    const retrievedState = await getUserState('non-existent-user');
    expect(retrievedState).toBeUndefined();
  });

  it('should clear user state', async () => {
    const state: UserState = { theme: mockTheme, style: mockStyle, timestamp: Date.now() };
    await setUserState('test-user', state);
    await clearUserState('test-user');
    const retrievedState = await getUserState('test-user');
    expect(retrievedState).toBeUndefined();
  });

  it('should return undefined for expired state', async () => {
    const expiredState: UserState = { theme: mockTheme, style: mockStyle, timestamp: Date.now() - (STATE_TTL * 1000) - 1000 }; // Expired 1 second ago
    await setUserState('test-user-expired', expiredState);
    const retrievedState = await getUserState('test-user-expired');
    expect(retrievedState).toBeUndefined();
  });
});