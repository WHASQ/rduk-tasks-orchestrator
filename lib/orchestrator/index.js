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

const orchestrate = config => {
  const logger = require('@rduk/logger')
  const broker = require('@rduk/message-broker')
  const tasks = require('../providers/tasks').getInstance()

  const orchestrator = config.name || 'default'

  let queue = []
  let inProgressTasks = []
  let limit = config.limit || 10
  let idleTime = config.idleTime || 500

  const unqueue = () => {
    setTimeout(() => {
      inProgressTasks = inProgressTasks.filter(task => !task.isCompleted)
      if (inProgressTasks.length < limit && queue.length > 0) {
        [...Array(Math.min(queue.length, limit - inProgressTasks.length)).keys()].forEach(() => {
          inProgressTasks.push(queue.shift().startOrResume())
        })
      }
      unqueue()
    }, idleTime)
  }

  // get all tasks uuids
  tasks.list(orchestrator)
    .then(uuids => {
      let promises = uuids.map(uuid => {
        return tasks.find(uuid)
          .then(info => {
            if (info.status === 'progress') {
              logger.info(`[${uuid}]: progress ${Math.ceil(info.current / info.total * 100)}%`)
              const msg = {
                instances: info.instances,
                orchestrator,
                options: {
                  task: uuid,
                  total: info.total
                }
              }

              // resume task by publishing a message in consumer queue
              broker.publish('headers', `${orchestrator}.consumers`, msg, {
                headers: {
                  type: info.type
                }
              })
            }

            return true
          })
      })

      return Promise.all(promises)
    })
    .then(() => {
      return broker.consume('orchestrator')
        .then(provider => {
          provider.on('MESSAGE_SUCCESS', (msg, consumer) => {
            queue.push(consumer)
          })
        })
    })
    .then(() => {
      unqueue()
    })
    .catch(err => {
      logger.error(err)
      process.exit(1)
    })
}

module.exports = config => {
  orchestrate(config || {})
}
