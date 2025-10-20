import { Theme, Style } from './types';

export interface UserState {
  theme: Theme;
  style: Style;
  timestamp: number;
}

// A simple in-memory state store. 
// In a real-world application, you would use a database like Redis.
const userState = new Map<string, UserState>();

const STATE_TTL = 5 * 60 * 1000; // 5 minutes

export function setUserState(userId: string, state: UserState) {
  userState.set(userId, state);
}

export function getUserState(userId: string): UserState | undefined {
  const state = userState.get(userId);
  if (state && (Date.now() - state.timestamp > STATE_TTL)) {
    // State has expired
    userState.delete(userId);
    return undefined;
  }
  return state;
}

export function clearUserState(userId: string) {
  userState.delete(userId);
}
