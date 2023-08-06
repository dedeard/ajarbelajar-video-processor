const Serialize = require('php-serialize')
const EventEmitter = require('events')
const { Redis } = require('ioredis')

class NodeLaravel extends EventEmitter {
  constructor({ client = new Redis(), scope, queue }) {
    super()
    this.client = client
    this.scope = scope
    this.queue = queue
  }

  pushJob(name, object) {
    const command = Serialize.serialize(object, this.scope)
    const data = {
      job: 'Illuminate\\Queue\\CallQueuedHandler@call',
      data: {
        commandName: name,
        command,
      },
      id: Date.now(),
      attempts: 1,
    }

    return this.pushToQueue(data)
  }

  pushEvent(name, object) {
    const eventData = Serialize.serialize(object, this.scope)
    const event = {
      event: name,
      data: eventData,
    }
    return this.pushToQueue(event)
  }

  pushToQueue(data) {
    return new Promise((resolve, reject) => {
      this.client.rpush(this.queue, JSON.stringify(data), (err, reply) => {
        if (err) {
          reject(new Error(err))
        } else {
          resolve(reply)
        }
      })
    })
  }

  listen() {
    const listenLoop = async () => {
      try {
        const reply = await this.client.blpop(this.queue, 0)
        if (reply && reply.length === 2) {
          const obj = JSON.parse(reply[1])
          const command = obj.data.command
          try {
            const raw = Serialize.unserialize(command, this.scope)
            if (typeof raw.onJob === 'function') await raw.onJob()
            else this.emit('job', { name: obj.data.commandName, data: raw })
          } catch (err) {
            this.emit('error', err)
          }
        }
      } catch (err) {
        this.emit('error', err)
      }

      listenLoop()
    }
    listenLoop()
  }
}

module.exports = NodeLaravel
