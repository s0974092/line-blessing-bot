import { setUserState, getUserState, clearUserState, UserState } from '../src/state';
import { Theme, Style } from '../src/types';

const mockTheme: Theme = { id: 't1', name: 'Theme 1', defaultText: 'Default', prompt: '...' };
const mockStyle: Style = { id: 's1', name: 'Style 1', prompt: '...' };

describe('State Management', () => {

  beforeEach(() => {
    // Clear state before each test
    clearUserState('test-user');
  });

  it('should set and get user state', () => {
    const state: UserState = { theme: mockTheme, style: mockStyle, timestamp: Date.now() };
    setUserState('test-user', state);
    const retrievedState = getUserState('test-user');
    expect(retrievedState).toEqual(state);
  });

  it('should return undefined for a non-existent user', () => {
    const retrievedState = getUserState('non-existent-user');
    expect(retrievedState).toBeUndefined();
  });

  it('should clear user state', () => {
    const state: UserState = { theme: mockTheme, style: mockStyle, timestamp: Date.now() };
    setUserState('test-user', state);
    clearUserState('test-user');
    const retrievedState = getUserState('test-user');
    expect(retrievedState).toBeUndefined();
  });

  it('should return undefined for expired state', async () => {
    const expiredState: UserState = { theme: mockTheme, style: mockStyle, timestamp: Date.now() - 6 * 60 * 1000 }; // 6 minutes ago
    setUserState('test-user', expiredState);
    const retrievedState = getUserState('test-user');
    expect(retrievedState).toBeUndefined();
  });
});
