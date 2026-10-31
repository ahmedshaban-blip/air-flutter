import * as fs from 'fs'
import * as path from 'path'
import { execFile, spawn, ChildProcess } from 'child_process'

export interface RecordingSession {
  serial: string
  startTime: number
  child: ChildProcess
}

export class ScreenRecorder {
  private activeSession: RecordingSession | undefined

  public isRecording(serial?: string): boolean {
    if (!this.activeSession) {
      return false
    }
    if (serial) {
      return this.activeSession.serial === serial
    }
    return true
  }

  public getDurationSeconds(): number {
    if (!this.activeSession) {
      return 0
    }
    return Math.floor((Date.now() - this.activeSession.startTime) / 1000)
  }

  public async startRecording(adbPath: string, serial: string): Promise<void> {
    if (this.activeSession) {
      throw new Error('A screen recording is already in progress.')
    }

    // Clean up any stale recording on device
    await new Promise<void>(resolve => {
      execFile(adbPath, ['-s', serial, 'shell', 'rm', '-f', '/sdcard/air_flutter_recording.mp4'], { windowsHide: true }, () => resolve())
    })

    const child = spawn(adbPath, ['-s', serial, 'shell', 'screenrecord', '--bit-rate', '6000000', '/sdcard/air_flutter_recording.mp4'], {
      windowsHide: true,
      stdio: 'ignore'
    })

    this.activeSession = {
      serial,
      startTime: Date.now(),
      child
    }

    child.on('exit', () => {
      this.activeSession = undefined
    })
  }

  public async stopRecording(adbPath: string, outputDirectory: string): Promise<string> {
    const session = this.activeSession
    if (!session) {
      throw new Error('No active screen recording session to stop.')
    }

    const serial = session.serial

    // Gracefully interrupt screenrecord on Android so MP4 container finalizes
    await new Promise<void>(resolve => {
      execFile(adbPath, ['-s', serial, 'shell', 'pkill', '-2', 'screenrecord'], { windowsHide: true }, () => resolve())
    })

    try {
      session.child.kill()
    } catch {
      // ignore
    }

    this.activeSession = undefined

    // Wait 1.5s for MediaMuxer to close file cleanly on the phone
    await new Promise(resolve => setTimeout(resolve, 1500))

    await fs.promises.mkdir(outputDirectory, { recursive: true })

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
    const destination = path.join(outputDirectory, `recording_${stamp}.mp4`)

    // Pull video from phone
    await new Promise<void>((resolve, reject) => {
      execFile(
        adbPath,
        ['-s', serial, 'pull', '/sdcard/air_flutter_recording.mp4', destination],
        { windowsHide: true, timeout: 60000 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || stdout || error.message))
          } else {
            resolve()
          }
        }
      )
    })

    // Delete remote file from phone
    await new Promise<void>(resolve => {
      execFile(adbPath, ['-s', serial, 'shell', 'rm', '-f', '/sdcard/air_flutter_recording.mp4'], { windowsHide: true }, () => resolve())
    })

    if (!fs.existsSync(destination) || (await fs.promises.stat(destination)).size < 1024) {
      throw new Error('Screen recording video was empty or failed to pull.')
    }

    return destination
  }
}

