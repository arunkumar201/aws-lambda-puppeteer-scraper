import puppeteerCore from 'puppeteer-core';
import type * as Puppeteer from 'puppeteer';
import * as PuppeteerCore from 'puppeteer-core';
import * as proxyChain from 'proxy-chain';
import UserAgent from 'user-agents';
import { v4 as uuidv4 } from 'uuid';
import { fetchProxyFromApi, releaseProxy } from '../utils/proxy-api';

interface ExtendedBrowser {
  closeWithProxy: () => Promise<void>;
  sessionId: string;
}

type PuppeteerBrowser = (Puppeteer.Browser | PuppeteerCore.Browser) & ExtendedBrowser;

type LaunchOptions = Puppeteer.LaunchOptions;

import chromium from '@sparticuz/chromium';
import logger from '../utils/logger';

let isBrowserInitializing = false;
const BROWSER_TIMEOUT_MS = 30000; // 30 seconds
const BROWSER_KEEP_ALIVE_MS = 30 * 60 * 1000; // 30 minutes
let lastUsedTimestamp = Date.now();

export interface BrowserConfig extends LaunchOptions {
  proxy?: string;
  userAgent?: string;
  captchaApiKey?: string;
}

export class BrowserFactory {
  private readonly config: BrowserConfig;
  private proxyServer: any = null;

  constructor(config: BrowserConfig = {}) {
    this.config = config;
  }

  private async getLaunchArgs(additionalArgs: string[] = []) {
    const args = [
      ...additionalArgs,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-infobars',
      '--disable-extensions',
      '--disable-features=TranslateUI,BlinkGenPropertyTrees',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-default-browser-check',
      '--noerrdialogs',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      `--user-agent=${new UserAgent().toString()}`,
    ];
    const proxyToUse = this.config.proxy;
    if (proxyToUse) {
      try {
        this.proxyServer = await proxyChain.anonymizeProxy({
          url: proxyToUse,
          port: 0,
          ignoreProxyCertificate: true,
        });
        args.push(`--proxy-server=${new URL(this.proxyServer).host}`);
      } catch (error) {
        logger.error('Failed to create proxy server:', error);
      }
    }
    return args;
  }

  private async setupProxyAuth(page: any) {
    if (!this.proxyServer) {
      return true;
    }

    try {
      logger.log({
        message: 'Proxy authentication handled by proxy-chain',
        level: 'info',
      });
      return true;
    } catch (error) {
      logger.error({
        message: 'Failed to set up proxy authentication',
        error: error instanceof Error ? error.message : String(error),
        level: 'error',
      });
      throw error;
    }
  }

  // Original close method to close the proxy
  private async closeProxyServer() {
    if (this.proxyServer) {
      try {
        await proxyChain.closeAnonymizedProxy(this.proxyServer, true);
        this.proxyServer = null;
        logger.log({ message: 'Proxy server closed', level: 'info' });
      } catch (error) {
        logger.error({
          message: 'Error closing proxy server',
          error: error instanceof Error ? error.message : String(error),
          level: 'error',
        });
      }
    }
  }

  public async cleanup(): Promise<void> {
    await this.closeProxyServer();
    logger.info('BrowserFactory cleanup complete: browser and proxy closed.');
  }

  private async createNewBrowser(): Promise<PuppeteerBrowser> {
    const isMacOS = process.platform === 'darwin';
    const isDevelopment = process.env.NODE_ENV !== 'production';

    logger.log({
      message: isMacOS ? 'Creating browser on macOS' : 'Creating browser on non-macOS',
      level: 'info',
      isDevelopment,
      isMacOS,
    });

    try {
      let browser: PuppeteerBrowser;

      if (isMacOS) {
        const PuppeteerExtra = await import('puppeteer-extra');
        const StealthPlugin = await import('puppeteer-extra-plugin-stealth');
        PuppeteerExtra.default.use(StealthPlugin.default());
        const launchOptions: Puppeteer.LaunchOptions = {
          args: await this.getLaunchArgs(),
          headless: false,
          defaultViewport: chromium.defaultViewport,
          timeout: BROWSER_TIMEOUT_MS,
          ...this.config,
        };

        if (isDevelopment && launchOptions) {
          launchOptions.headless = false;

          //   launchOptions.args =
          //     launchOptions?.args &&
          //     launchOptions?.args.filter(arg => !arg.startsWith('--proxy-server='));
        }

        logger.log({
          message: 'Launching browser with options',
          options: {
            ...launchOptions,
            args:
              launchOptions.args &&
              launchOptions.args.map(arg => (arg.includes('proxy') ? '--proxy-server=****' : arg)),
          },
          level: 'debug',
        });

        browser = (await PuppeteerExtra.default.launch(
          launchOptions
        )) as unknown as PuppeteerBrowser;
      } else {
        const PuppeteerExtra = await import('puppeteer-extra');
        const StealthPlugin = await import('puppeteer-extra-plugin-stealth');
        PuppeteerExtra.default.use(StealthPlugin.default());
        const launchOptions: Puppeteer.LaunchOptions = {
          args: await this.getLaunchArgs([...chromium.args]),
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
          timeout: BROWSER_TIMEOUT_MS,
          ...this.config,
        };

        logger.log({
          message: 'Launching browser with options',
          options: {
            ...launchOptions,
            args:
              launchOptions.args &&
              launchOptions.args.map(arg => (arg.includes('proxy') ? '--proxy-server=****' : arg)),
          },
          level: 'debug',
        });

        browser = (await PuppeteerExtra.default.launch(
          launchOptions
        )) as unknown as PuppeteerBrowser;
      }

      const page = await browser.newPage();
      await page.setDefaultNavigationTimeout(BROWSER_TIMEOUT_MS);
      await page.setDefaultTimeout(BROWSER_TIMEOUT_MS);
      await this.setupProxyAuth(page);
      await page.close();

      //block analytics api calls or other unwanted api calls
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (
          request.resourceType() === 'stylesheet' ||
          request.resourceType() === 'font' ||
          request.resourceType() === 'image'
        ) {
          request.abort();
        } else if (request.url().includes('google-analytics')) {
          request.abort();
        } else {
          request.continue();
        }
      });

      const sessionId = uuidv4();
      const extendedBrowser = browser as PuppeteerBrowser;
      extendedBrowser.sessionId = sessionId;
      extendedBrowser.closeWithProxy = async () => {
        await this.releaseBrowser(extendedBrowser);
      };
      browser = extendedBrowser;

      logger.info(`Browser session ${sessionId} created`);
      return browser;
    } catch (error) {
      // Only close proxy if browser creation failed, otherwise leave it for cleanup()
      await this.closeProxyServer();
      logger.error('Error creating browser:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        platform: process.platform,
      });
      throw error;
    }
  }

  private async releaseBrowser(browser: PuppeteerBrowser) {
    try {
      const sessionId = (browser as any).sessionId;
      logger.info(`Releasing browser session: ${sessionId}`);

      // Don't close the browser, just close all pages
      const pages = await browser.pages();
      await Promise.all(pages.map(page => page.close().catch(() => {})));

      logger.info(`Browser session ${sessionId} pages closed`);
    } catch (error) {
      logger.error('Error releasing browser:', {
        error: error instanceof Error ? error.message : String(error),
        sessionId: (browser as any).sessionId,
      });
      // Don't throw, we want to keep the browser alive
    }
  }

  public async createBrowser(maxRetries = 3): Promise<PuppeteerBrowser> {
    let attempt = 0;
    let lastError: any = null;
    while (attempt < maxRetries) {
      try {
        const proxyDetails = await fetchProxyFromApi();
        this.config.proxy = proxyDetails.data.proxies[0].url;
        const browser = await this.createNewBrowser();
        lastUsedTimestamp = Date.now();
        logger.info(`Browser created with proxy: ${this.config.proxy}`);
        await releaseProxy(proxyDetails.data.proxies[0].id);
        return browser;
      } catch (error) {
        lastError = error;
        attempt++;
        logger.error(`Proxy failed, retrying with new proxy (attempt ${attempt}): ${error}`);
      }
    }
    try {
      logger.warn('All proxy attempts failed. Launching browser without proxy as fallback.');
      this.config.proxy = undefined;
      const browser = await this.createNewBrowser();
      lastUsedTimestamp = Date.now();
      return browser;
    } catch (finalError) {
      throw lastError || finalError || new Error('Failed to create browser with or without proxy');
    }
  }

  // Method to explicitly close the browser when needed (now handled by cleanup)
  public async closeBrowser(): Promise<void> {
    await this.cleanup();
  }
}
