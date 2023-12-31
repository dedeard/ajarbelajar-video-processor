const path = require('path')
const { createLogger, format, transports } = require('winston')
const config = require('./config')

const logger = createLogger({
  level: config.isDev ? 'debug' : 'info',
  format: config.logging
    ? format.combine(format.colorize(), format.simple())
    : format.combine(format.timestamp(), format.json()),
})

if (config.logging) {
  logger.add(new transports.Console())
} else {
  logger.add(
    new transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
    }),
  )
  logger.add(
    new transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
    }),
  )
}

module.exports = logger
