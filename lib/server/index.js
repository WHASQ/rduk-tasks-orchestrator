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

const serve = (config) => {
  const logger = require('@rduk/logger')
  const app = require('express')()
  const server = require('http').Server(app)
  const io = require('socket.io')(server)
  const redis = require('redis')
  const uuidv4 = require('uuid/v4')
  const broker = require('@rduk/message-broker')
  const port = config.port || 1304
  const orchestrator = config.name || 'default'

  const provider = require('../providers/tasks').getInstance()

  server.listen(port, () => {
    logger.info(`server listening on port ${port}`)
  })

  const sub = redis.createClient(provider.config.address)
  sub.subscribe('tasks')
  sub.on('message', function (channel, message) {
    io.emit('message', JSON.parse(message))
  })

  io.on('connection', (socket) => {
    socket.join(socket.id)
    socket.on('create', info => {
      const uuid = info.uuid || uuidv4()
      const msg = {
        instances: info.instances || 1,
        orchestrator,
        options: {
          task: uuid,
          isResumable: false,
          total: info.total || 100
        }
      }

      // create task by publishing a message in consumer queue
      broker.publish('headers', `${orchestrator}.consumers`, msg, {
        headers: {
          type: info.type
        }
      })

      io.to(socket.id).emit('created', uuid)
      io.to(socket.id).emit('created:' + uuid, uuid)
    })
    socket.on('disconnect', () => {
      socket.leave(socket.id)
    })
  })
}

module.exports = (config) => {
  serve(config || {})
}
