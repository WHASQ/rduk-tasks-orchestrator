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

  // get all tasks uuids
  tasks.list()
    .then(uuids => {
      let promises = uuids.map(uuid => {
        return tasks.find(uuid)
          .then(info => {
            if (info.status === 'progress') {
              logger.info(`[${uuid}]: progress ${Math.ceil(info.current / info.total * 100)}%`)
              const msg = {
                instances: info.instances,
                options: {
                  task: uuid,
                  total: info.total
                }
              }

              // resume task by publishing a message in consumer queue
              broker.publish('headers', 'consumers', msg, {
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
      broker.consume('orchestrator')
    })
    .catch(err => {
      logger.error(err)
      process.exit(1)
    })
}

module.exports = (config) => {
  orchestrate(config || {})
}
