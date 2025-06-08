import puppeteerCore from 'puppeteer-core';
import type * as Puppeteer from 'puppeteer';
import type * as PuppeteerCore from 'puppeteer-core';

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

  constructor(config: BrowserConfig = {}) {
    this.config = config;
  }

  public async createBrowser(): Promise<PuppeteerBrowser> {
    const args = [];
    if (this.config.proxy) args.push(`--proxy-server=${this.config.proxy}`);
    if (process.platform === 'darwin') {
      logger.log({ message: 'current system is macos', level: 'info' });
      const puppeteer = await import('puppeteer');
      const browserPuppeteer: PuppeteerBrowser = await puppeteer.launch({
        args,
        headless: false,
        defaultViewport: {
          width: 1920,
          height: 1080,
        },
        ...this.config,
      });

      logger.log({ message: 'browser created', level: 'info' });
      return browserPuppeteer;
    } else {
      logger.log({ message: 'current system is not macos', level: 'info' });
      try {
        const browserCore = await puppeteerCore.launch({
          args: [...chromium.args],
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
        });
        logger.log({ message: 'browser created', level: 'info' });
        return browserCore;
      } catch (error) {
        logger.error('Error launching browser on non-macOS system:', {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }
    }
  }
}
