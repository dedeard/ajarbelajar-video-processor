const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.join(__dirname, '../../.env') })

const config = {
  isProd: process.env.NODE_ENV === 'production',
  isDev: process.env.NODE_ENV !== 'production',

  logging: process.env.LOGGING === 'true',

  redis: {
    host: String(process.env.REDIS_HOST || 'localhost'),
    port: Number(process.env.REDIS_PORT || 6379),
    username: String(process.env.REDIS_USER || 'default'),
    password: String(process.env.REDIS_PASS || 'null'),
  },

  minio: {
    bucket: String(process.env.MINIO_BUCKET || 'local'),
    region: String(process.env.MINIO_REGION || 'us-east-1'),
    config: {
      endPoint: String(process.env.MINIO_ENDPOINT || 'localhost'),
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: String(process.env.MINIO_ACCESS_KEY || 'sail'),
      secretKey: String(process.env.MINIO_SECRET_KEY || 'password'),
    },
  },
}

module.exports = config
