import Redis from 'ioredis';
import { Theme, Style } from './types';

export interface UserState {
  theme: Theme;
  style: Style;
  timestamp: number;
  // Optionally, you could add sourceId here if you want to store it within the state object
  // sourceId?: string; 
}

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err) => console.error('Redis Client Error', err));

export const STATE_TTL = 5 * 60; // 5 minutes in seconds for Redis expire

export async function setUserState(sourceId: string, state: UserState) {
  await redis.set(sourceId, JSON.stringify(state), 'EX', STATE_TTL);
}

export async function getUserState(sourceId: string): Promise<UserState | undefined> {
  const stateStr = await redis.get(sourceId);
  if (stateStr) {
    const state = JSON.parse(stateStr) as UserState;
    // Check if the state has expired
    if (Date.now() - state.timestamp > STATE_TTL * 1000) {
      // State has expired, clear it and return undefined
      await clearUserState(sourceId);
      return undefined;
    }
    return state;
  }
  return undefined;
}

export async function clearUserState(sourceId: string) {
  await redis.del(sourceId);
}
