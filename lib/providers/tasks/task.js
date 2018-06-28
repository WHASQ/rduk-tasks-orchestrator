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

const { EventEmitter } = require('events')
const uuidv4 = require('uuid/v4')
const redis = require('redis')
const tasks = require('./')

class Task extends EventEmitter {
  static get TASK_INITIALIZED() {
    return 'TASK_INITIALIZED'
  }
  static get TASK_PROGRESS() {
    return 'TASK_PROGRESS'
  }
  static get TASK_COMPLETED() {
    return 'TASK_COMPLETED'
  }
  constructor(uuid, isResumable) {
    super()
    this.isResumable = isResumable === false ? false : !!uuid
    this.uuid = uuid || uuidv4()
    this.initialized = false
    this.completed = false
    this.provider = tasks.getInstance()
  }
  get key () {
    return `task:${this.uuid}`
  }
  initialize(total, instances, type, title) {
    if (!this.initialized) {
      this.initialized = this.provider.create(this, total, instances, type, title)
        .then(() => {
          this.emit(Task.TASK_INITIALIZED, this.uuid)
        })
    }

    return this.initialized
  }
  advance(step) {
    return this.provider.advance(this, step)
      .then((reply) => {
        this.emit(Task.TASK_PROGRESS, reply)
      })
  }
  complete() {
    if (!this.completed) {
      this.completed = this.provider.complete(this)
        .then(() => {
          this.emit(Task.TASK_COMPLETED)
        })
    }

    return this.completed
  }
}

module.exports = Task
