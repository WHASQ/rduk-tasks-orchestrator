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

const Base = require('./base')
const redis = require('redis')

class RedisTasksProvider extends Base {
  initialize () {
    this.client = redis.createClient(this.config.address)
  }
  list () {
    return new Promise((resolve, reject) => {
      this.client.smembers('tasks', (err, tasks) => {
        if (err) {
          reject(err)
        } else {
          resolve(tasks)
        }
      })
    })
  }
  find (uuid) {
    return new Promise((resolve, reject) => {
      this.client.hmget(`task:${uuid}`, 'status', 'instances', 'type', 'current', 'total', 'title',
        (err, [status, instances, type, current, total, title]) => {
          if (err) {
            reject(err)
          } else {
            resolve({
              status,
              type,
              title,
              instances: parseInt(instances),
              current: parseInt(current),
              total: parseInt(total)
            })
          }
        }
      )
    })
  }
  create (task, total, instances, type, title) {
    this.client.sadd('tasks', task.uuid)
    return new Promise((resolve, reject) => {
      this.client.hset(task.key,
        'status', 'progress',
        'current', 0,
        'total', total || 100,
        'instances', instances || 1,
        'type', type,
        'title', title,
        (err) => {
          if (err) {
            reject(err)
          } else {
            this.client.publish('tasks', JSON.stringify({
              type: 'created',
              uuid: task.uuid
            }))
            resolve(true)
          }
        }
      )
    })
  }
  advance (task, step) {
    return new Promise((resolve, reject) => {
      this.client.hincrby(task.key, 'current', step || 1, (err, reply) => {
        if (err) {
          reject(err)
        } else {
          this.client.publish('tasks', JSON.stringify({
            type: 'progress',
            uuid: task.uuid,
            progress: reply,
            total: task.total
          }))
          resolve(reply)
        }
      })
    })
  }
  complete (task) {
    this.client.srem('tasks', task.uuid)
    return new Promise((resolve, reject) => {
      this.client.hset(task.key,
        'status', 'complete',
        (err) => {
          if (err) {
            reject(err)
          } else {
            this.client.publish('tasks', JSON.stringify({
              type: 'completed',
              uuid: task.uuid
            }))
            resolve(true)
          }
        }
      )
    })
  }
}

module.exports = RedisTasksProvider
