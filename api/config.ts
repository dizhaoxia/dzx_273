export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  redisUrl: process.env.REDIS_URL || '',
  postgresUrl: process.env.DATABASE_URL || '',
  snapshotInterval: parseInt(process.env.SNAPSHOT_INTERVAL || '30000', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

export default config;
