const Queue = require('bull');

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

const moderationQueue = new Queue('audio-moderation', { redis: redisConfig });
const emailQueue = new Queue('email-sending', { redis: redisConfig });

module.exports = {
  moderationQueue,
  emailQueue
};
