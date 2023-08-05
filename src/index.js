const config = require('./config/config')
const Minio = require('minio')
const redis = require('redis')
const logger = require('./config/logger')

const minioClient = new Minio.Client(config.minio.config)
const bucketName = config.minio.bucket

const redisClient = redis.createClient(config.redis)

redisClient.on('error', (err) => logger.error('Redis Client Error', err))
;(async () => {
  const bucketsList = await minioClient.listBuckets()
  logger.info(`Buckets List: ${bucketsList.map((bucket) => bucket.name).join(',\t')}`)

  await redisClient.connect()

  await redisClient.set('key', 'value')

  const val = await redisClient.get('key')
  logger.info(val)

  await redisClient.disconnect()
})()
