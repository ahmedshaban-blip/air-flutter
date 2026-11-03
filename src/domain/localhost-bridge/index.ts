import * as globalStateKeys from '../../config/global-state-keys'
import { AndroidDeviceManager } from '../android-device-manager'

export const LOCALHOST_BRIDGE_PRESETS = [3000, 5000, 5001, 8000, 8080, 1337] as const

export interface LocalhostBridgeRule {
  deviceId: string
  port: number
  managed: boolean
}

interface BridgeStorage {
  get<T>(key: string, defaultValue?: T): T | undefined
  update(key: string, value: unknown): Thenable<void>
}

type ChangeListener = (rules: LocalhostBridgeRule[]) => void

export class LocalhostBridge {
  private rules: LocalhostBridgeRule[]
  private readonly listeners = new Set<ChangeListener>()
  private shutdownInFlight?: Promise<void>

  constructor(
    private readonly storage: BridgeStorage,
    private readonly deviceManager: AndroidDeviceManager
  ) {
    this.rules = this.sanitizeRules(
      storage.get<LocalhostBridgeRule[]>(globalStateKeys.localhostBridgeRules(), []) || []
    )
  }

  public onDidChange(listener: ChangeListener): { dispose(): void } {
    this.listeners.add(listener)
    return { dispose: () => this.listeners.delete(listener) }
  }

  public getRules(): LocalhostBridgeRule[] {
    return this.rules.map(rule => ({ ...rule }))
  }

  public async apply(deviceId: string, port: number): Promise<LocalhostBridgeRule[]> {
    this.validatePort(port)
    await this.deviceManager.addReversePort(deviceId, port)

    const activePorts = await this.deviceManager.listReversePorts(deviceId)
    if (!activePorts.includes(port)) {
      throw new Error(`ADB did not confirm tcp:${port} on ${deviceId}.`)
    }

    const managedPorts = this.managedPorts(deviceId)
    managedPorts.add(port)
    await this.replaceDeviceRules(deviceId, activePorts, managedPorts)
    return this.getRules()
  }

  public async refresh(deviceIds: string[]): Promise<LocalhostBridgeRule[]> {
    const uniqueIds = Array.from(new Set(deviceIds.filter(Boolean)))
    const connected = new Set(uniqueIds)
    const retained = this.rules.filter(rule => connected.has(rule.deviceId))
    const { refreshedIds, activeRules } = await this.inspectDevices(uniqueIds)

    await this.setRules([
      ...retained.filter(rule => !refreshedIds.has(rule.deviceId)),
      ...activeRules
    ])
    return this.getRules()
  }

  private async inspectDevices(deviceIds: string[]): Promise<{
    refreshedIds: Set<string>
    activeRules: LocalhostBridgeRule[]
  }> {
    const results = await Promise.allSettled(
      deviceIds.map(async deviceId => ({
        deviceId,
        ports: await this.deviceManager.listReversePorts(deviceId)
      }))
    )

    const refreshedIds = new Set<string>()
    const activeRules: LocalhostBridgeRule[] = []
    for (const result of results) {
      if (result.status === 'fulfilled') {
        refreshedIds.add(result.value.deviceId)
        const managedPorts = this.managedPorts(result.value.deviceId)
        activeRules.push(...result.value.ports.map(port => ({
          deviceId: result.value.deviceId,
          port,
          managed: managedPorts.has(port)
        })))
      }
    }
    return { refreshedIds, activeRules }
  }

  public async refreshDevice(deviceId: string): Promise<LocalhostBridgeRule[]> {
    const activePorts = await this.deviceManager.listReversePorts(deviceId)
    await this.replaceDeviceRules(deviceId, activePorts)
    return this.getRules()
  }

  public async remove(deviceId: string, port: number): Promise<LocalhostBridgeRule[]> {
    this.validatePort(port)
    await this.deviceManager.removeReversePort(deviceId, port)
    const activePorts = await this.deviceManager.listReversePorts(deviceId)
    if (activePorts.includes(port)) {
      throw new Error(`ADB still reports tcp:${port} on ${deviceId}.`)
    }
    await this.replaceDeviceRules(deviceId, activePorts)
    return this.getRules()
  }

  public async removeAll(deviceId: string): Promise<LocalhostBridgeRule[]> {
    await this.deviceManager.removeAllReversePorts(deviceId)
    const activePorts = await this.deviceManager.listReversePorts(deviceId)
    if (activePorts.length > 0) {
      throw new Error(`ADB still reports reversed ports on ${deviceId}.`)
    }
    await this.replaceDeviceRules(deviceId, [])
    return this.getRules()
  }

  /** Removes only Air Flutter-tracked rules, preserving rules created elsewhere. */
  public async cleanupDevice(deviceId: string): Promise<void> {
    const tracked = this.rules.filter(rule => rule.deviceId === deviceId && rule.managed)
    await Promise.allSettled(
      tracked.map(rule => this.deviceManager.removeReversePort(deviceId, rule.port))
    )
    await this.replaceDeviceRules(deviceId, [])
  }

  public shutdown(): Promise<void> {
    if (!this.shutdownInFlight) {
      this.shutdownInFlight = this.removeTrackedRules()
    }
    return this.shutdownInFlight
  }

  private async removeTrackedRules(): Promise<void> {
    const tracked = this.getRules().filter(rule => rule.managed)
    await Promise.allSettled(
      tracked.map(rule => this.deviceManager.removeReversePort(rule.deviceId, rule.port))
    )
    await this.setRules([])
  }

  private async replaceDeviceRules(
    deviceId: string,
    ports: number[],
    managedPorts = this.managedPorts(deviceId)
  ): Promise<void> {
    await this.setRules([
      ...this.rules.filter(rule => rule.deviceId !== deviceId),
      ...ports.map(port => ({ deviceId, port, managed: managedPorts.has(port) }))
    ])
  }

  private async setRules(rules: LocalhostBridgeRule[]): Promise<void> {
    const next = this.sanitizeRules(rules)
    if (JSON.stringify(next) === JSON.stringify(this.rules)) {
      return
    }
    this.rules = next
    await this.storage.update(
      globalStateKeys.localhostBridgeRules(),
      next.filter(rule => rule.managed)
    )
    for (const listener of this.listeners) {
      listener(this.getRules())
    }
  }

  private sanitizeRules(rules: LocalhostBridgeRule[]): LocalhostBridgeRule[] {
    const unique = new Map<string, LocalhostBridgeRule>()
    for (const rule of rules) {
      if (rule && typeof rule.deviceId === 'string' && Number.isInteger(rule.port) && rule.port >= 1 && rule.port <= 65535) {
        unique.set(`${rule.deviceId}:${rule.port}`, {
          deviceId: rule.deviceId,
          port: rule.port,
          managed: rule.managed !== false
        })
      }
    }
    return Array.from(unique.values()).sort((a, b) =>
      a.deviceId.localeCompare(b.deviceId) || a.port - b.port
    )
  }

  private validatePort(port: number): void {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('Port must be a whole number from 1 to 65535.')
    }
  }

  private managedPorts(deviceId: string): Set<number> {
    return new Set(
      this.rules
        .filter(rule => rule.deviceId === deviceId && rule.managed)
        .map(rule => rule.port)
    )
  }
}
