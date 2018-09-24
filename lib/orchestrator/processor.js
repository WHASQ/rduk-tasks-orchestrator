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

'use strict'

const errors = require('@rduk/errors')
const logger = require('@rduk/logger')
const BaseProcessor = require('@rduk/message-broker/lib/processor/base')
const Consumer = require('./consumer')

const consumers = new Map()
const kill = consumer => {
  logger.info(`[${consumer.uuid}]: consumer stopping...`)
  consumer.forked.forEach(fork => {
    logger.info(`[${consumer.uuid}]: kill child process (${fork.pid})`)
    fork.kill('SIGINT')
  })
  consumers.delete(consumer.uuid)
}

process.on('SIGINT', () => {
  logger.info('Gracefully shutdown consumers...')
  consumers.forEach((consumer, key) => {
    kill(consumer)
  })
  process.exit()
})

class WorkersProcessor extends BaseProcessor {
  run (msg, channel) {
    if (!msg || !msg.content) {
      errors.throwArgumentError('msg', msg)
    }

    if (!msg.properties.headers.type) {
      errors.throwArgumentError('msg', msg)
    }

    return this.translator.translate(msg.content)
      .then(message => {
        let consumer = new Consumer(
          msg.properties.headers.type,
          message.instances || 1,
          message.options,
          () => {
            logger.info(`[${consumer.uuid}]: task completed`)
            kill(consumer)
            channel.deleteQueue(consumer.key)
            consumer.dispose()
          }
        )

        return consumer
      })
      .then(consumer => {
        consumers.set(consumer.uuid, consumer)
        return msg
      })
  }
}

module.exports = WorkersProcessor
