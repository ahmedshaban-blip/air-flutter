import * as http from 'http';
import * as net from 'net';
import * as stream from 'stream';

export type MockProxyMode = 'none' | 'error_500' | 'error_404' | 'error_401' | 'delay';

export interface MockProxyOptions {
  mode: MockProxyMode;
  delayMs?: number;
  customStatusCode?: number;
  customMessage?: string;
}

export class MockErrorProxyService {
  private static instance: MockErrorProxyService | null = null;
  private server: http.Server | null = null;
  private port: number = 0;
  private currentOptions: MockProxyOptions = { mode: 'none' };

  public static getInstance(): MockErrorProxyService {
    if (!MockErrorProxyService.instance) {
      MockErrorProxyService.instance = new MockErrorProxyService();
    }
    return MockErrorProxyService.instance;
  }

  public isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  public getPort(): number {
    return this.port;
  }

  public getCurrentOptions(): MockProxyOptions {
    return { ...this.currentOptions };
  }

  public async start(options: MockProxyOptions): Promise<{ port: number }> {
    this.currentOptions = { ...options };

    if (this.server && this.server.listening) {
      return { port: this.port };
    }

    return new Promise<{ port: number }>((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });

      // Handle HTTPS CONNECT tunneling for HTTPS error/delay injection
      this.server.on('connect', (req, clientSocket, head) => {
        this.handleHttpsConnect(req, clientSocket, head);
      });

      this.server.on('error', (err) => {
        console.error('[MockErrorProxyService] Server error:', err);
      });

      this.server.listen(0, '0.0.0.0', () => {
        const addr = this.server?.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
          resolve({ port: this.port });
        } else {
          reject(new Error('Failed to acquire server port.'));
        }
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    return new Promise<void>((resolve) => {
      this.server?.close(() => {
        this.server = null;
        this.port = 0;
        this.currentOptions = { mode: 'none' };
        resolve();
      });
    });
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const { mode, delayMs = 3000, customStatusCode, customMessage } = this.currentOptions;

    const executeResponse = () => {
      if (res.writableEnded) return;

      if (mode === 'error_500' || (mode === 'none' && customStatusCode === 500)) {
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          status: 500,
          error: 'Internal Server Error',
          message: customMessage || 'Simulated 500 Internal Server Error by Air Flutter',
          timestamp: new Date().toISOString()
        }));
        return;
      }

      if (mode === 'error_404' || customStatusCode === 404) {
        res.writeHead(404, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          status: 404,
          error: 'Not Found',
          message: customMessage || 'Simulated 404 Not Found by Air Flutter',
          timestamp: new Date().toISOString()
        }));
        return;
      }

      if (mode === 'error_401' || customStatusCode === 401) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          status: 401,
          error: 'Unauthorized',
          message: customMessage || 'Simulated 401 Unauthorized by Air Flutter',
          timestamp: new Date().toISOString()
        }));
        return;
      }

      // Default or delay response
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        status: 200,
        message: 'Air Flutter Mock Proxy OK',
        delayedMs: mode === 'delay' ? delayMs : 0
      }));
    };

    if (mode === 'delay') {
      setTimeout(executeResponse, Math.max(100, delayMs));
    } else {
      executeResponse();
    }
  }

  private handleHttpsConnect(req: http.IncomingMessage, clientSocket: stream.Duplex, head: Buffer): void {
    const { mode, delayMs = 3000 } = this.currentOptions;

    const terminateOrRespond = () => {
      if (clientSocket.destroyed) return;

      if (mode === 'error_500' || mode === 'error_404' || mode === 'error_401') {
        // Return 502/500 proxy error or drop socket to trigger network failure in HTTPS
        clientSocket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
        clientSocket.end();
        return;
      }

      // For delay or drop
      clientSocket.destroy();
    };

    if (mode === 'delay') {
      setTimeout(terminateOrRespond, Math.max(100, delayMs));
    } else {
      terminateOrRespond();
    }
  }
}
