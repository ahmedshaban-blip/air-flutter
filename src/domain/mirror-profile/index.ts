export type MirrorAudioRoute = 'computer' | 'phone'
export type MirrorPerformanceProfile = 'speed' | 'balanced' | 'ultra'

export interface MirrorLaunchPreferences {
  audioRoute: MirrorAudioRoute
  performanceProfile: MirrorPerformanceProfile
}

export interface MirroringState {
  isMirroring: boolean
  displayOff: boolean
  serial?: string
}

interface MirrorProfile {
  maxSize?: number
  maxFps: number
  videoBitRate: string
  disableMipmaps: boolean
}

const PROFILES: Record<MirrorPerformanceProfile, MirrorProfile> = {
  speed: { maxSize: 1024, maxFps: 120, videoBitRate: '8M', disableMipmaps: true },
  balanced: { maxSize: 1600, maxFps: 60, videoBitRate: '8M', disableMipmaps: false },
  // The highest caps scrcpy accepts: native resolution. The device encoder,
  // panel refresh rate and Wi-Fi decide what actually arrives — FPS is a cap,
  // never a guarantee.
  ultra: { maxFps: 120, videoBitRate: '16M', disableMipmaps: false }
}

export function buildMirrorTuningArguments(profileName: MirrorPerformanceProfile): string[] {
  const profile = PROFILES[profileName]
  const args = [
    `--max-fps=${profile.maxFps}`,
    `--video-bit-rate=${profile.videoBitRate}`,
    '--video-buffer=0'
  ]
  if (profile.maxSize) {
    args.unshift(`--max-size=${profile.maxSize}`)
  }
  if (profile.disableMipmaps) {
    args.push('--no-mipmaps')
  }
  return args
}

export function buildMirrorAudioArguments(audioRoute: MirrorAudioRoute): string[] {
  return audioRoute === 'computer' ? ['--audio-source=output'] : ['--no-audio']
}

export function isMirrorAudioRoute(value: unknown): value is MirrorAudioRoute {
  return value === 'computer' || value === 'phone'
}

export function isMirrorPerformanceProfile(value: unknown): value is MirrorPerformanceProfile | 'quality' {
  return value === 'speed' || value === 'balanced' || value === 'ultra' || value === 'quality'
}

/** Legacy saved preferences used 'quality' (a low-FPS profile); map it to ultra. */
export function normalizeMirrorPerformanceProfile(
  value: MirrorPerformanceProfile | 'quality'
): MirrorPerformanceProfile {
  return value === 'quality' ? 'ultra' : value
}
