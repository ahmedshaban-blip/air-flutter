const assert = require('assert')
const { LocalhostBridge } = require('../out/domain/localhost-bridge')

class MemoryStorage {
  constructor() {
    this.values = new Map()
  }

  get(key, fallback) {
    return this.values.has(key) ? this.values.get(key) : fallback
  }

  async update(key, value) {
    this.values.set(key, value)
  }
}

class FakeDeviceManager {
  constructor() {
    this.ports = new Map()
    this.calls = []
  }

  async addReversePort(deviceId, port) {
    this.calls.push(['add', deviceId, port])
    this.ports.set(deviceId, [...new Set([...(this.ports.get(deviceId) || []), port])])
  }

  async listReversePorts(deviceId) {
    this.calls.push(['list', deviceId])
    return [...(this.ports.get(deviceId) || [])]
  }

  async removeReversePort(deviceId, port) {
    this.calls.push(['remove', deviceId, port])
    this.ports.set(deviceId, (this.ports.get(deviceId) || []).filter(active => active !== port))
  }

  async removeAllReversePorts(deviceId) {
    this.calls.push(['removeAll', deviceId])
    this.ports.set(deviceId, [])
  }
}

async function run() {
  const storage = new MemoryStorage()
  const devices = new FakeDeviceManager()
  const bridge = new LocalhostBridge(storage, devices)

  await bridge.apply('device-1', 3000)
  assert.deepStrictEqual(devices.calls.slice(0, 2), [
    ['add', 'device-1', 3000],
    ['list', 'device-1']
  ])
  assert.deepStrictEqual(bridge.getRules(), [{ deviceId: 'device-1', port: 3000, managed: true }])

  devices.ports.set('device-1', [3000, 8080])
  await bridge.refreshDevice('device-1')
  assert.deepStrictEqual(bridge.getRules(), [
    { deviceId: 'device-1', port: 3000, managed: true },
    { deviceId: 'device-1', port: 8080, managed: false }
  ])

  await bridge.remove('device-1', 3000)
  assert.deepStrictEqual(bridge.getRules(), [
    { deviceId: 'device-1', port: 8080, managed: false }
  ])

  await assert.rejects(() => bridge.apply('device-1', 0), /1 to 65535/)
  await bridge.shutdown()
  assert.ok(!devices.calls.some(call => call[0] === 'remove' && call[2] === 8080))
}

run()
  .then(() => console.log('Localhost Bridge tests passed'))
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
