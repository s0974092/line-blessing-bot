
import type { Redis as RedisType } from 'ioredis';
import Redis from 'ioredis-mock';
import { setUserState, getUserState, clearUserState, UserState } from '../src/state';
import { config } from '../src/config';

// Mock the ioredis module
jest.mock('ioredis', () => require('ioredis-mock'));

// Mock the config module
jest.mock('../src/config', () => ({
  config: {
    redis: {
      url: 'redis://localhost:6379',
    },
    userState: {
      ttlSeconds: 10, // Use a short TTL for testing
    },
  },
}));

describe('state management', () => {
  let redis: RedisType;

  beforeEach(() => {
    // Create a new mock Redis instance for each test
    redis = new Redis();
    // Clear all data from the mock Redis instance
    redis.flushall();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const sourceId = 'testUser';
  const userState: UserState = {
    theme: { 
      id: 'theme1', 
      name: 'Test Theme', 
      prompt: 'a test theme', 
      defaultText: 'Default text', 
      thumbnail: 'thumb.jpg' 
    },
    style: { 
      id: 'style1', 
      name: 'Test Style', 
      prompt: 'a test style', 
      thumbnail: 'thumb.jpg' 
    },
    timestamp: Date.now(),
  };

  it('should set and get user state', async () => {
    await setUserState(sourceId, userState);
    const retrievedState = await getUserState(sourceId);
    
    expect(retrievedState).toEqual(userState);
  });

  it('should return undefined for non-existent state', async () => {
    const retrievedState = await getUserState('nonExistentUser');
    expect(retrievedState).toBeUndefined();
  });

  it('should clear user state', async () => {
    await setUserState(sourceId, userState);
    let retrievedState = await getUserState(sourceId);
    expect(retrievedState).not.toBeUndefined();

    await clearUserState(sourceId);
    retrievedState = await getUserState(sourceId);
    expect(retrievedState).toBeUndefined();
  });

  it('should return undefined for expired state', async () => {
    const expiredState: UserState = {
      ...userState,
      timestamp: Date.now() - (config.userState.ttlSeconds + 1) * 1000,
    };
    await setUserState(sourceId, expiredState);
    
    const retrievedState = await getUserState(sourceId);
    expect(retrievedState).toBeUndefined();
  });
});
