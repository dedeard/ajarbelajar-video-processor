const Serialize = require('php-serialize')
const EventEmitter = require('events')
const { Redis } = require('ioredis')
const { randomUUID } = require('crypto')

/**
 * Represents a NodeLaravel instance that extends the EventEmitter class.
 * @class
 * @extends EventEmitter
 * @param {Object} options - The options for creating a new NodeLaravel instance.
 * @param {Redis} [options.client=new Redis()] - The Redis client to use.
 * @param {string} options.scope - The scope of the NodeLaravel instance.
 * @param {string} options.queue - The queue of the NodeLaravel instance.
 */
class NodeLaravel extends EventEmitter {
  constructor({ client = new Redis(), scope, queue }) {
    super()
    this.client = client
    this.scope = scope
    this.queue = queue
  }

  /**
   * Pushes a job to the queue with the given name and object.
   * @param {string} name - The name of the job.
   * @param {object} object - The object to be serialized and pushed to the queue.
   * @returns {Promise} A promise that resolves with the reply from the Redis client.
   * @throws {Error} If there is an error pushing the job to the queue.
   */
  push(name, object) {
    const command = Serialize.serialize(object, this.scope)
    const data = {
      uuid: randomUUID(),
      job: 'Illuminate\\Queue\\CallQueuedHandler@call',
      data: {
        commandName: name,
        command,
      },
      id: Date.now(),
      attempts: 0,
    }

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

  /**
   * Starts listening for messages on a Redis queue and executes the corresponding commands.
   * @returns None
   */
  listen() {
    const listenLoop = async () => {
      try {
        const reply = await this.client.blpop(this.queue, 0)
        if (reply && reply.length === 2) {
          const obj = JSON.parse(reply[1])
          console.log(obj)
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
