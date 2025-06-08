import puppeteerCore from 'puppeteer-core';
import type * as Puppeteer from 'puppeteer';
import type * as PuppeteerCore from 'puppeteer-core';
import * as proxyChain from 'proxy-chain';
import UserAgent from 'user-agents';

type PuppeteerBrowser = Puppeteer.Browser | PuppeteerCore.Browser;
type LaunchOptions = Puppeteer.LaunchOptions;

import chromium from '@sparticuz/chromium';
import logger from '../utils/logger';

export interface BrowserConfig extends LaunchOptions {
  proxy?: string;
  userAgent?: string;
  captchaApiKey?: string;
}

export class BrowserFactory {
  private readonly config: BrowserConfig;
  private readonly proxyConfig = {
    host: process.env.PROXY_HOST,
    port: parseInt(process.env.PROXY_PORT || '80',10),
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
    get proxyUrl() {
      return `http://${this.username}:${this.password}@${this.host}:${this.port}`;
    }
  };

  private proxyServer: any = null;

  constructor(config: BrowserConfig = {}) {
    this.config = config;
  }

  private async getLaunchArgs(additionalArgs: string[] = []) {
    // Create a proxy server with proxy-chain
    this.proxyServer = await proxyChain.anonymizeProxy({
      url: this.proxyConfig.proxyUrl,
      port: 0,
      ignoreProxyCertificate: true,
    });

    logger.log({
      message: 'Proxy server created',
      proxyUrl: this.proxyServer,
      level: 'info'
    });

    const userAgent = new UserAgent().toString();

    return [
      ...additionalArgs,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-infobars',
      `--proxy-server=${new URL(this.proxyServer).host}`,
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      `--user-agent=${userAgent}`,
    ];
  }

  private async setupProxyAuth(page: any) {
    try {
      // No need for manual auth as proxy-chain handles it
      logger.log({ message: 'Proxy authentication handled by proxy-chain',level: 'info' });
      return true;
    } catch (error) {
      logger.error({
        message: 'Failed to set up proxy authentication',
        error: error instanceof Error ? error.message : String(error),
        level: 'error'
      });
      throw error;
    }
  }

  public async close() {
    if (this.proxyServer) {
      try {
        await proxyChain.closeAnonymizedProxy(this.proxyServer,true);
        this.proxyServer = null;
        logger.log({ message: 'Proxy server closed',level: 'info' });
      } catch (error) {
        logger.error({
          message: 'Error closing proxy server',
          error: error instanceof Error ? error.message : String(error),
          level: 'error'
        });
      }
    }
  }

  public async createBrowser(): Promise<PuppeteerBrowser> {
    if (process.platform === 'darwin') {
      logger.log({ message: 'current system is macos', level: 'info' });
      const puppeteer = await import('puppeteer');
      const browserPuppeteer: PuppeteerBrowser = await puppeteer.launch({
        args: await this.getLaunchArgs(),
        headless: true,
        defaultViewport: {
          width: 1920,
          height: 1080,
        },
        ...this.config,
      });

      const page = await browserPuppeteer.newPage();
      await this.setupProxyAuth(page);
      await page.close();

      logger.log({ message: 'browser created with proxy',level: 'info' });
      (browserPuppeteer as any).closeWithProxy = async () => {
        await browserPuppeteer.close();
        await this.close();
      };
      return browserPuppeteer;
    } else {
      logger.log({ message: 'current system is not macos', level: 'info' });
      try {
        const browserCore = await puppeteerCore.launch({
          args: await this.getLaunchArgs([...chromium.args]),
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
        });

        // Set up proxy authentication
        const page = await browserCore.newPage();
        await this.setupProxyAuth(page);
        await page.close();

        logger.log({ message: 'browser created with proxy',level: 'info' });
        // Store the close function on the browser instance
        (browserCore as any).closeWithProxy = async () => {
          await browserCore.close();
          await this.close();
        };
        return browserCore;
      } catch (error) {
        await this.close();
        logger.error('Error launching browser on non-macOS system:', {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }
    }
  }
}
