import { execFile } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

export interface SigningKeyOptions {
  projectPath: string
  fileName: string
  alias: string
  storePassword: string
  keyPassword: string
  fullName: string
  organizationalUnit?: string
  organization?: string
  city?: string
  state?: string
  countryCode?: string
  validityDays?: number
  keySize?: 2048 | 4096
}

export interface SigningKeyResult {
  keyPath: string
  relativeKeyPath: string
  fileName: string
  alias: string
}

export class SigningKeyGenerator {
  public static async generate(options: SigningKeyOptions): Promise<SigningKeyResult> {
    const signingOptions = this.validate(options)
    const appDir = path.join(signingOptions.projectPath, 'android', 'app')
    const keyPath = path.join(appDir, signingOptions.fileName)

    if (fs.existsSync(keyPath)) {
      throw new Error(`A signing key named "${signingOptions.fileName}" already exists in android/app. Choose another file name.`)
    }

    const keytoolPath = this.resolveKeytoolPath()
    const distinguishedName = this.createDistinguishedName(signingOptions)
    const keytoolArgs = [
      '-genkeypair',
      '-v',
      '-keystore', keyPath,
      '-storetype', 'JKS',
      '-keyalg', 'RSA',
      '-keysize', String(signingOptions.keySize),
      '-validity', String(signingOptions.validityDays),
      '-alias', signingOptions.alias,
      '-dname', distinguishedName,
      '-storepass:env', 'AIR_FLUTTER_STORE_PASSWORD',
      '-keypass:env', 'AIR_FLUTTER_KEY_PASSWORD',
      '-noprompt'
    ]

    try {
      await this.runKeytool(keytoolPath, keytoolArgs, signingOptions.storePassword, signingOptions.keyPassword)
    } catch (error) {
      if (fs.existsSync(keyPath)) {
        await fs.promises.unlink(keyPath)
      }
      throw error
    }

    return {
      keyPath,
      relativeKeyPath: path.join('android', 'app', signingOptions.fileName),
      fileName: signingOptions.fileName,
      alias: signingOptions.alias
    }
  }

  private static validate(options: SigningKeyOptions): Required<SigningKeyOptions> {
    const projectPath = options.projectPath?.trim()
    if (!projectPath || !fs.existsSync(path.join(projectPath, 'pubspec.yaml'))) {
      throw new Error('Select a valid Flutter project containing pubspec.yaml.')
    }
    if (!fs.existsSync(path.join(projectPath, 'android', 'app'))) {
      throw new Error('The selected Flutter project does not contain android/app.')
    }

    const requestedFileName = options.fileName?.trim() || 'upload-keystore.jks'
    const fileName = requestedFileName.toLowerCase().endsWith('.jks')
      ? requestedFileName
      : `${requestedFileName}.jks`
    if (path.basename(fileName) !== fileName || !/^[A-Za-z0-9._-]+\.jks$/i.test(fileName)) {
      throw new Error('Key file name may only contain letters, numbers, dots, underscores, and hyphens.')
    }

    const alias = options.alias?.trim()
    if (!alias || alias.length > 100) {
      throw new Error('Key alias is required and must be 100 characters or fewer.')
    }
    if (!options.storePassword || options.storePassword.length < 6) {
      throw new Error('Keystore password must contain at least 6 characters.')
    }
    if (!options.keyPassword || options.keyPassword.length < 6) {
      throw new Error('Key password must contain at least 6 characters.')
    }

    const fullName = options.fullName?.trim()
    if (!fullName) {
      throw new Error('Certificate owner name is required.')
    }

    const countryCode = options.countryCode?.trim().toUpperCase() || ''
    if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
      throw new Error('Country code must contain exactly two letters, for example EG or US.')
    }

    const validityDays = options.validityDays ?? 10000
    if (!Number.isInteger(validityDays) || validityDays < 1) {
      throw new Error('Validity period must be a positive whole number of days.')
    }

    const keySize = options.keySize ?? 2048
    if (keySize !== 2048 && keySize !== 4096) {
      throw new Error('RSA key size must be 2048 or 4096 bits.')
    }

    return {
      projectPath,
      fileName,
      alias,
      storePassword: options.storePassword,
      keyPassword: options.keyPassword,
      fullName,
      organizationalUnit: options.organizationalUnit?.trim() || '',
      organization: options.organization?.trim() || '',
      city: options.city?.trim() || '',
      state: options.state?.trim() || '',
      countryCode,
      validityDays,
      keySize
    }
  }

  private static createDistinguishedName(options: Required<SigningKeyOptions>): string {
    const distinguishedNameFields: Array<[string, string]> = [
      ['CN', options.fullName],
      ['OU', options.organizationalUnit],
      ['O', options.organization],
      ['L', options.city],
      ['ST', options.state],
      ['C', options.countryCode]
    ]
    return distinguishedNameFields
      .filter(([, value]) => value.length > 0)
      .map(([key, value]) => `${key}=${this.escapeDistinguishedNameValue(value)}`)
      .join(',')
  }

  private static escapeDistinguishedNameValue(value: string): string {
    let escaped = value.replace(/([,+=<>#;"\\])/g, '\\$1')
    escaped = escaped.replace(/^\s/, '\\ ').replace(/\s$/, '\\ ')
    return escaped
  }

  private static resolveKeytoolPath(): string {
    const javaHome = process.env.JAVA_HOME
    if (javaHome) {
      const executable = process.platform === 'win32' ? 'keytool.exe' : 'keytool'
      const candidate = path.join(javaHome, 'bin', executable)
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }
    return process.platform === 'win32' ? 'keytool.exe' : 'keytool'
  }

  private static runKeytool(
    executable: string,
    args: string[],
    storePassword: string,
    keyPassword: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(executable, args, {
        windowsHide: true,
        timeout: 60000,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          AIR_FLUTTER_STORE_PASSWORD: storePassword,
          AIR_FLUTTER_KEY_PASSWORD: keyPassword
        }
      }, (error, _stdout, stderr) => {
        if (!error) {
          resolve()
          return
        }

        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(new Error('Java keytool was not found. Install JDK 17 or set JAVA_HOME, then try again.'))
          return
        }

        const detail = stderr.trim().split(/\r?\n/).filter(Boolean).pop()
        reject(new Error(detail ? `keytool failed: ${detail}` : `keytool failed: ${error.message}`))
      })
    })
  }
}
