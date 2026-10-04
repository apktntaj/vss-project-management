import * as assert from 'node:assert/strict'
import { getNextEventJobView } from './event-job-view'

const views = { 'event-1': false, 'event-2': true }

assert.deepEqual(getNextEventJobView(views, 'event-1'), {
  'event-1': true,
  'event-2': true,
})
assert.deepEqual(getNextEventJobView(views, 'event-2'), {
  'event-1': false,
  'event-2': false,
})
assert.deepEqual(getNextEventJobView({}, 'event-3'), { 'event-3': true })

console.log('event job view toggle tests passed')
