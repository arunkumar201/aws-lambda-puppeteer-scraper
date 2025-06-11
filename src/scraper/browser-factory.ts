import puppeteerCore from 'puppeteer-core';
import type * as Puppeteer from 'puppeteer';
import * as PuppeteerCore from 'puppeteer-core';
import * as proxyChain from 'proxy-chain';
import UserAgent from 'user-agents';
import { v4 as uuidv4 } from 'uuid';

interface ExtendedBrowser {
  closeWithProxy: () => Promise<void>;
  sessionId: string;
}

type PuppeteerBrowser = (Puppeteer.Browser | PuppeteerCore.Browser) & ExtendedBrowser;

type LaunchOptions = Puppeteer.LaunchOptions;

import chromium from '@sparticuz/chromium';
import logger from '../utils/logger';

let browserInstance: PuppeteerBrowser | null = null;
let isBrowserInitializing = false;
const BROWSER_TIMEOUT_MS = 30000; // 30 seconds
const BROWSER_KEEP_ALIVE_MS = 30 * 60 * 1000; // 30 minutes
let lastUsedTimestamp = Date.now();
let keepAliveInterval: NodeJS.Timeout | undefined;

// Ensure only one instance of BrowserFactory exists
let browserFactoryInstance: BrowserFactory | null = null;

export interface BrowserConfig extends LaunchOptions {
  proxy?: string;
  userAgent?: string;
  captchaApiKey?: string;
}

export class BrowserFactory {
  private readonly config: BrowserConfig;
  private readonly proxyConfig = {
    host: process.env.PROXY_HOST,
    port: parseInt(process.env.PROXY_PORT || '80', 10),
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
    get isAvailable() {
      return this.host && this.port && this.username && this.password;
    },
    get proxyUrl() {
      return this.isAvailable
        ? `http://${this.username}:${this.password}@${this.host}:${this.port}`
        : '';
    },
  };

  private proxyServer: any = null;

  constructor(config: BrowserConfig = {}) {
    this.config = config;
    if (browserFactoryInstance) {
      return browserFactoryInstance; // Return existing instance for singleton
    }
    browserFactoryInstance = this; // Set this instance as the singleton
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

    // Only set up proxy if all required proxy config is available
    if (this.proxyConfig.isAvailable) {
      try {
        this.proxyServer = await proxyChain.anonymizeProxy({
          url: this.proxyConfig.proxyUrl,
          port: 0,
          ignoreProxyCertificate: true,
        });

        logger.log({
          message: 'Proxy server created',
          level: 'info',
        });

        args.push(`--proxy-server=${new URL(this.proxyServer).host}`);
      } catch (error) {
        logger.error('Failed to create proxy server:', {
          error: error instanceof Error ? error.message : String(error),
          level: 'error',
        });
      }
    } else {
      logger.log({
        message: 'Proxy not configured, running without proxy',
        level: 'info',
      });
    }

    return args;
  }

  private async setupProxyAuth(page: any) {
    if (!this.proxyConfig.isAvailable) {
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
    if (browserInstance) {
      try {
        await browserInstance.close(); // Close the Puppeteer browser instance
        logger.info('Browser instance closed during cleanup.');
      } catch (error) {
        logger.error('Error closing browser instance during cleanup:', {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        browserInstance = null; // Clear the global browser instance
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = undefined;
        }
      }
    }
    await this.closeProxyServer();
    browserFactoryInstance = null;
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
        const puppeteer = await import('puppeteer');
        const PuppeteerExtra = await import('puppeteer-extra');
        const StealthPlugin = await import('puppeteer-extra-plugin-stealth');
        PuppeteerExtra.default.use(StealthPlugin.default());
        const launchOptions: Puppeteer.LaunchOptions = {
          args: await this.getLaunchArgs(),
          headless: true,
          defaultViewport: {
            width: 1280,
            height: 800,
          },

          timeout: BROWSER_TIMEOUT_MS,
          ...this.config,
        };

        if (isDevelopment && launchOptions) {
          launchOptions.headless = false;

          launchOptions.args =
            launchOptions?.args &&
            launchOptions?.args.filter(arg => !arg.startsWith('--proxy-server='));
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
        browser = (await puppeteerCore.launch({
          args: await this.getLaunchArgs([...chromium.args]),
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
          timeout: BROWSER_TIMEOUT_MS,
        })) as unknown as PuppeteerBrowser;
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

  private async getBrowser(): Promise<PuppeteerBrowser> {
    if (browserInstance && (await this.isBrowserAlive(browserInstance))) {
      return browserInstance;
    }

    return this.createNewBrowser();
  }

  private async isBrowserAlive(browser: PuppeteerBrowser): Promise<boolean> {
    try {
      await browser.version();
      return true;
    } catch (error) {
      return false;
    }
  }

  public async createBrowser(): Promise<PuppeteerBrowser> {
    if (browserInstance && (await this.isBrowserAlive(browserInstance))) {
      lastUsedTimestamp = Date.now();
      startKeepAlive(); // Ensure keep-alive is running
      return browserInstance;
    }

    while (isBrowserInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (browserInstance) {
        return browserInstance;
      }
    }

    // Create new browser instance
    isBrowserInitializing = true;
    try {
      browserInstance = await this.createNewBrowser();
      lastUsedTimestamp = Date.now();
      startKeepAlive(); // Start keep-alive when creating new browser
      return browserInstance;
    } catch (error) {
      console.error('Failed to create browser:', error);
      throw error;
    } finally {
      isBrowserInitializing = false;
    }
  }

  // Method to explicitly close the browser when needed (now handled by cleanup)
  public async closeBrowser(): Promise<void> {
    if (browserFactoryInstance) {
      await browserFactoryInstance.cleanup();
    }
  }

  // The global function to be called on process exit/SIGINT
  // This will call the cleanup method on the singleton BrowserFactory instance.
  public static async globalShutdownHandler(): Promise<void> {
    if (browserFactoryInstance) {
      logger.info('Initiating global BrowserFactory shutdown.');
      await browserFactoryInstance.cleanup();
    } else {
      logger.info('No BrowserFactory instance to globally shut down.');
    }
  }
}

function startKeepAlive() {
  if (keepAliveInterval) return;

  keepAliveInterval = setInterval(async () => {
    if (browserInstance) {
      try {
        const page = await browserInstance!.newPage();
        await page.goto('about:blank');
        await page.close();
        lastUsedTimestamp = Date.now();
      } catch (error) {
        console.error('Keep-alive check failed, will create new browser on next request:', error);
        browserInstance = null;
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = undefined;
        }
      }
    }
  }, 60000); // Check every minute
}

// Remove the redundant keepProcessAliveInterval
// clearInterval(keepProcessAliveInterval);

// Update process event listeners to call the static shutdown handler
process.on('SIGINT', async () => {
  logger.info('SIGINT received. Triggering global shutdown handler.');
  await BrowserFactory.globalShutdownHandler();
  process.exit(0); // Exit cleanly
});

process.on('exit', async code => {
  logger.info(`Process exiting with code: ${code}. Triggering global shutdown handler.`);
  await BrowserFactory.globalShutdownHandler();
});
