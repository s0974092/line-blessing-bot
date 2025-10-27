import Redis from 'ioredis';
import { Theme, Style } from './types';
import { config } from './config';

export interface UserState {
  theme: Theme;
  style: Style;
  timestamp: number;
  // Optionally, you could add sourceId here if you want to store it within the state object
  // sourceId?: string; 
}

// Initialize Redis client using config
const redis = new Redis(config.redis.url);

redis.on('error', (err) => console.error('Redis Client Error', err));

export async function setUserState(sourceId: string, state: UserState) {
  await redis.set(sourceId, JSON.stringify(state), 'EX', config.userState.ttlSeconds);
}

export async function getUserState(sourceId: string): Promise<UserState | undefined> {
  const stateStr = await redis.get(sourceId);
  if (stateStr) {
    const state = JSON.parse(stateStr) as UserState;
    // Check if the state has expired
    if (Date.now() - state.timestamp > config.userState.ttlSeconds * 1000) {
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
