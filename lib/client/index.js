/**
 * MIT License
 *
 * Copyright (c) 2016 - 2018 RDUK <tech@rduk.fr>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const IoConnect = require('socket.io-client').connect
const uuidv4 = require('uuid/v4')
const logger = require('@rduk/logger')
const provider = require('@rduk/message-broker/lib/provider')

const DEFAULT_CONFIG = {
  address: 'http://localhost:1304'
}

const connect = config => {
  const socket = new IoConnect(config.address)
  socket.on('message', message => {
    console.log(message)
  })

  const create = task => (
    new Promise((resolve, reject) => {
      let uuid = uuidv4()
      task.uuid = uuid

      const onCreated = uuid => {
        socket.removeListener('created:' + uuid, onCreated)
        return provider.getInstance().createChannel()
          .then(channel => {
            return channel.assertQueue('task:' + uuid)
              .then(() => {
                return channel.close()
              })
          })
          .then(() => {
            resolve(task)
          })
          .catch(err => {
            logger.error(err)
            reject(err)
          })
      }
      socket.on('created:' + uuid, onCreated)
      socket.emit('create', task)
    })
  )

  const feed = (uuid, data) => (
    new Promise((resolve, reject) => {
      if (!Array.isArray(data)) {
        data = [data]
      }

      let queue = `task:${uuid}`

      return provider.getInstance().createChannel()
        .then(channel => {
          return channel.assertQueue(queue)
            .then(() => {
              return Promise.all(data.map(datum => {
                return channel.publish('', queue, Buffer.from(JSON.stringify(datum)))
              }))
            })
            .then(() => {
              return channel.close()
            })
            .then(() => {
              resolve(uuid)
            })
        })
        .catch(err => {
          logger.error(err)
          reject(err)
        })
    })
  )

  return {
    create: create,
    feed: feed
  }
}

module.exports = (config) => {
  return connect(Object.assign(DEFAULT_CONFIG, config || {}))
}
