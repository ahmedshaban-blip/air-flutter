export interface FlutterOverlaysState {
  debugPaint: boolean;
  performanceOverlay: boolean;
  slowAnimations: boolean;
  repaintRainbow: boolean;
  paintBaselines: boolean;
}

export type FlutterOverlayType = keyof FlutterOverlaysState;

export interface OverlayToggleResult {
  overlay: FlutterOverlayType;
  enabled: boolean;
  state: FlutterOverlaysState;
  hotkey: string;
}

export const OVERLAY_HOTKEYS: Record<FlutterOverlayType, { key: string; name: string; description: string }> = {
  debugPaint: {
    key: 'p',
    name: 'Debug Paint',
    description: 'Renders borders, padding, and alignments of every RenderObject'
  },
  performanceOverlay: {
    key: 'P',
    name: 'Performance Overlay',
    description: 'Displays GPU and UI thread graphs and frame render times'
  },
  slowAnimations: {
    key: 'S',
    name: 'Slow Animations',
    description: 'Slows down animation speed by 5x to inspect micro-transitions'
  },
  repaintRainbow: {
    key: 't',
    name: 'Repaint Rainbow',
    description: 'Colors render layers in rotating colors whenever they repaint'
  },
  paintBaselines: {
    key: 'b',
    name: 'Paint Baselines',
    description: 'Displays text baseline alignment lines for typography'
  }
};

export class FlutterDebugOverlaysService {
  private state: FlutterOverlaysState = {
    debugPaint: false,
    performanceOverlay: false,
    slowAnimations: false,
    repaintRainbow: false,
    paintBaselines: false
  };

  constructor(
    private readonly sendFlutterKeystroke?: (char: string) => Promise<boolean>
  ) {}

  public getState(): FlutterOverlaysState {
    return { ...this.state };
  }

  public async toggleOverlay(overlay: FlutterOverlayType): Promise<OverlayToggleResult> {
    const nextVal = !this.state[overlay];
    this.state[overlay] = nextVal;

    const meta = OVERLAY_HOTKEYS[overlay];
    if (this.sendFlutterKeystroke && meta) {
      await this.sendFlutterKeystroke(meta.key);
    }

    return {
      overlay,
      enabled: nextVal,
      state: this.getState(),
      hotkey: meta ? meta.key : ''
    };
  }

  public async setOverlay(overlay: FlutterOverlayType, enabled: boolean): Promise<OverlayToggleResult> {
    if (this.state[overlay] !== enabled) {
      return this.toggleOverlay(overlay);
    }
    const meta = OVERLAY_HOTKEYS[overlay];
    return {
      overlay,
      enabled,
      state: this.getState(),
      hotkey: meta ? meta.key : ''
    };
  }

  public resetAll(): FlutterOverlaysState {
    this.state = {
      debugPaint: false,
      performanceOverlay: false,
      slowAnimations: false,
      repaintRainbow: false,
      paintBaselines: false
    };
    return this.getState();
  }
}

