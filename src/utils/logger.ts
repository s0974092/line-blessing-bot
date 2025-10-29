const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const levels: { [key: string]: number } = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = levels[LOG_LEVEL.toLowerCase()] ?? levels.info;

const log = (level: string, levelNumber: number, ...args: any[]) => {
  if (levelNumber <= currentLevel) {
    console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}]`, ...args);
  }
};

export const logger = {
  error: (...args: any[]) => log('error', levels.error, ...args),
  warn: (...args: any[]) => log('warn', levels.warn, ...args),
  info: (...args: any[]) => log('info', levels.info, ...args),
  debug: (...args: any[]) => log('debug', levels.debug, ...args),
};
