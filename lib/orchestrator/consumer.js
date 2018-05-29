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

const { fork } = require('child_process')
const logger = require('@rduk/logger')
const typeLoader = require('@rduk/configuration/lib/sections/field/type').load
const Task = require('../providers/tasks/task')
const provider = require('../providers/tasks')

class Consumer extends Task {
  static get CONSUMER_STARTED() {
    return 'CONSUMER_STARTED'
  }
  constructor(type, instances, options, onTaskCompleted) {
    super(options.task, !!options.isResumable)
    this.type = type
    this.instances = instances
    this.total = options.total || 100
    this.options = options
    this.on(Task.TASK_PROGRESS, this._onTaskProgress)
    this.once(Task.TASK_INITIALIZED, this._onTaskInitialized)
    this.once(Task.TASK_COMPLETED, onTaskCompleted || (() => { this.dispose() }))
  }
  start() {
    logger.info(`[${this.uuid}]: consumer started...`)
    this.initialize(this.total, this.instances, this.type)
    return this
  }
  resume() {
    logger.info(`[${this.uuid}]: consumer resumed...`)
    this._launch()
    return this
  }
  startOrResume() {
    if (this.isResumable) {
      return this.resume()
    }

    return this.start()
  }
  dispose() {
    this.removeListener(Task.TASK_PROGRESS, this._onTaskProgress)
  }
  _launch() {
    this.forked = [...Array(this.instances).keys()].map(() => {
      let forkableTask = typeLoader(provider.getInstance().getType(this.type))
      let forked = forkableTask.execute(this.key)
      logger.info(`[${this.uuid}]: child process started (${forked.pid})`)
      forked.on('message', (msg) => {
        if (msg.type === 'progress') {
          this.advance(msg.step)
        }
      })
      this.emit(Consumer.CONSUMER_STARTED)
      return forked
    })
  }
  /* listeners */
  _onTaskInitialized() {
    logger.info(`[${this.uuid}]: task initialized...`)
    this._launch()
  }
  _onTaskProgress(progress) {
    logger.info(`[${this.uuid}]: progress ${Math.ceil(progress / this.total * 100)}%`)
    if (progress >= this.total) {
      this.complete()
    }
  }

}

module.exports = Consumer
