export interface TextRange {
  startLine: number
  startChar: number
  endLine: number
  endChar: number
}

export interface AndroidRecommended {
  agp: string
  gradle: string
  java: number
  kotlin: string
}

export interface AndroidRule {
  agpRange: string
  compatibleGradle: string
  minJava: number
  recommendedGradle: string
  recommendedKotlin?: string
  compatibleKotlin?: string
  description?: string
  migrationUrl?: string
}

export interface IosRecommended {
  minDeploymentTarget: string
}

export interface AvailableVersions {
  agp: string[]
  gradle: string[]
  kotlin: string[]
  java: number[]
  ios: string[]
}

export interface CompatibilityMatrix {
  version: string
  lastUpdated: string
  android: {
    recommended: AndroidRecommended
    rules: AndroidRule[]
  }
  ios: {
    recommended: IosRecommended
    deprecatedTargets: string[]
    description?: string
    migrationUrl?: string
  }
  availableVersions: AvailableVersions
}

export interface ParsedJavaConfig {
  appBuildGradlePath?: string
  sourceCompatibility?: string
  sourceCompatibilityRange?: TextRange
  targetCompatibility?: string
  targetCompatibilityRange?: TextRange
  jvmTarget?: string
  jvmTargetRange?: TextRange
}

export interface ParsedGradleInfo {
  wrapperPath?: string
  gradleVersion?: string
  gradleRange?: TextRange
  buildGradlePath?: string
  agpVersion?: string
  agpRange?: TextRange
  kotlinVersion?: string
  kotlinRange?: TextRange
  javaConfig?: ParsedJavaConfig
  isKotlinDsl: boolean
}

export interface ParsedPodfileInfo {
  exists: boolean
  podfilePath?: string
  deploymentTarget?: string
  targetRange?: TextRange
}

export interface EnvironmentInfo {
  javaVersion: number | null
  rawJavaOutput: string
  cocoapodsVersion: string | null
  isWindows: boolean
  notes: string[]
}

export interface SuggestedFix {
  description: string
  filePath: string
  range: TextRange
  newText: string
}

export interface CompatibilityIssue {
  type: 'error' | 'warning' | 'info'
  code:
    | 'AGP_GRADLE_MISMATCH'
    | 'JAVA_AGP_MISMATCH'
    | 'OUTDATED_STACK'
    | 'OUTDATED_IOS_TARGET'
    | 'DEPRECATED_IOS_TARGET'
  message: string
  filePath?: string
  range?: TextRange
  suggestedFix?: SuggestedFix
  migrationUrl?: string
}

export interface CompatibilityReport {
  projectPath: string
  scannedAt: string
  gradle: ParsedGradleInfo
  podfile: ParsedPodfileInfo
  environment: EnvironmentInfo
  issues: CompatibilityIssue[]
  isHealthy: boolean
  canAutoUpgrade: boolean
}

export interface CustomStackConfig {
  agp: string
  gradle: string
  kotlin: string
  java: number
  iosTarget: string
}

export interface StackDiffItem {
  id: string
  title: string
  filePath: string
  currentValue: string
  targetValue: string
  description: string
  range?: TextRange
  selected: boolean
}

