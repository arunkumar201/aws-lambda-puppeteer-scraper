interface ChatBotStreamOptions {
  messageContainer?: string;
  typingIndicator?: string;
  stopButton?: string;
  streamingClass?: string;
  completedClass?: string;
  maxWaitTime?: number;
  timeout?: number;
  checkInterval?: number;
  stableCountThreshold?: number;
  additionalSelectors?: {
    loadingSpinner?: string;
    sendButton?: string;
    inputField?: string;
  };
}

interface StreamResult {
  success: boolean;
  content: string;
  duration: number;
  chunks: string[];
  error?: string;
  metadata: {
    totalChunks: number;
    averageChunkSize: number;
    streamEndReason: string;
    platform?: string;
  };
}

class MultiPlatformChatBotWaiter {
  private page: any; // Puppeteer page or similar
  private options: any;

  // Platform-specific configurations
  private static PLATFORM_CONFIGS = {
    chatgpt: {
      messageContainer:
        '[data-message-author-role="assistant"] .markdown, [data-message-author-role="assistant"] div[class*="prose"], .group\\/conversation-turn .whitespace-pre-wrap',
      typingIndicator:
        '.result-streaming, [data-testid*="loading"], .animate-pulse, .text-token-text-secondary',
      stopButton: '[data-testid="stop-button"], button[aria-label*="Stop"], .stop-generating',
      streamingClass: 'result-streaming',
      completedClass: 'group',
      loadingSpinner: '.animate-spin, [data-testid="loading-indicator"]',
      sendButton: '[data-testid="send-button"], button[aria-label*="Send"]',
      inputField: '#prompt-textarea, [data-testid="prompt-textarea"]',
    },

    perplexity: {
      messageContainer: '.prose, [data-testid="answer"], .answer-content, .markdown-content',
      typingIndicator:
        '.typing-animation, .loading-dots, .animate-pulse, [aria-label*="generating"]',
      stopButton: '[aria-label*="Stop"], .stop-button, button[title*="Stop"]',
      streamingClass: 'streaming',
      completedClass: 'completed',
      loadingSpinner: '.loading-spinner, .animate-spin',
      sendButton: 'button[type="submit"], [aria-label*="Submit"]',
      inputField: 'textarea, [contenteditable="true"]',
    },

    claude: {
      messageContainer:
        '[data-is-streaming="false"] .font-claude-message, .message-content, [role="assistant"] .prose',
      typingIndicator: '[data-is-streaming="true"], .thinking-indicator, .loading-ellipsis',
      stopButton: '[aria-label*="Stop"], .stop-generation',
      streamingClass: 'streaming',
      completedClass: 'message-complete',
      loadingSpinner: '.loading, .spinner',
      sendButton: 'button[aria-label*="Send"], [data-testid="send-button"]',
      inputField: 'div[contenteditable="true"], textarea[placeholder*="message"]',
    },

    bing: {
      messageContainer: '.ac-textBlock, .response-message-group .ac-container',
      typingIndicator: '.typing-indicator, .loading-message, .ac-adaptiveCard .loading',
      stopButton: '.stop-responding-button, [aria-label*="Stop"]',
      streamingClass: 'streaming-response',
      completedClass: 'response-complete',
    },

    bard: {
      messageContainer: '.model-response-text, .response-container .rich-text',
      typingIndicator: '.typing-indicator, .loading-animation',
      stopButton: '[aria-label*="Stop"], .stop-generating',
      streamingClass: 'generating',
      completedClass: 'response-finished',
    },
  };

  constructor(page: any, options: any = {}) {
    this.page = page;
    this.options = {
      maxWaitTime: 120000, // 2 minutes
      timeout: 30000,
      checkInterval: 200,
      stableCountThreshold: 4,
      ...options,
    };
  }

  private log(message: string, data?: any): void {
    if (this.options.debug) {
      console.log(`[ChatBotWaiter] ${message}`, data || '');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Auto-detect the current platform based on URL and DOM elements
   */
  private async detectPlatform(): Promise<string> {
    try {
      const url = await this.page.url();
      const hostname = new URL(url).hostname.toLowerCase();

      // URL-based detection
      if (hostname.includes('openai.com') || hostname.includes('chatgpt.com')) {
        return 'chatgpt';
      }
      if (hostname.includes('perplexity.ai')) {
        return 'perplexity';
      }
      if (hostname.includes('claude.ai') || hostname.includes('anthropic.com')) {
        return 'claude';
      }
      if (hostname.includes('bing.com') || hostname.includes('copilot.microsoft.com')) {
        return 'bing';
      }
      if (hostname.includes('bard.google.com') || hostname.includes('gemini.google.com')) {
        return 'bard';
      }

      // DOM-based detection as fallback
      const platformIndicators = await this.page.evaluate(() => {
        const indicators = {
          chatgpt: document.querySelector('[data-testid="send-button"], #prompt-textarea') !== null,
          perplexity: document.querySelector('.perplexity-logo, [data-testid="answer"]') !== null,
          claude: document.querySelector('.font-claude-message, [data-is-streaming]') !== null,
          bing: document.querySelector('.ac-textBlock, .response-message-group') !== null,
          bard: document.querySelector('.model-response-text, .bard-container') !== null,
        };
        return indicators;
      });

      for (const [platform, detected] of Object.entries(platformIndicators)) {
        if (detected) {
          this.log(`Platform detected via DOM: ${platform}`);
          return platform;
        }
      }

      this.log('Platform detection failed, using generic configuration');
      return 'generic';
    } catch (error) {
      this.log('Error during platform detection', error);
      return 'generic';
    }
  }

  /**
   * Get configuration for the specified platform
   */
  private getPlatformConfig(platform: string): ChatBotStreamOptions {
    const config =
      MultiPlatformChatBotWaiter.PLATFORM_CONFIGS[
        platform as keyof typeof MultiPlatformChatBotWaiter.PLATFORM_CONFIGS
      ];

    if (!config) {
      // Generic fallback configuration
      return {
        messageContainer: '[role="assistant"], .message, .response, .bot-message, .ai-response',
        typingIndicator:
          '.typing, .loading, .generating, .thinking, .animate-pulse, [aria-busy="true"]',
        stopButton: '.stop, [aria-label*="stop" i], [title*="stop" i], .stop-button',
        streamingClass: 'streaming',
        completedClass: 'completed',
      };
    }

    return config;
  }

  /**
   * Enhanced chatbot response waiting with multi-platform support
   */
  async waitForChatBotResponse(customOptions: ChatBotStreamOptions = {}): Promise<StreamResult> {
    const detectedPlatform = await this.detectPlatform();
    const platformConfig = this.getPlatformConfig(detectedPlatform);

    // Merge configurations: custom options > platform config > defaults
    const chatOptions: Required<ChatBotStreamOptions> = {
      messageContainer: '[data-message-content], .message-content, .response-content',
      typingIndicator: '.typing-indicator, .generating, .thinking',
      stopButton: '[data-stop], .stop-generating, .stop-button',
      streamingClass: 'streaming',
      completedClass: 'completed',
      maxWaitTime: this.options.maxWaitTime,
      timeout: this.options.timeout,
      checkInterval: this.options.checkInterval,
      stableCountThreshold: this.options.stableCountThreshold,
      additionalSelectors: {},
      ...platformConfig,
      ...customOptions,
    };

    this.log(`Starting chatbot response monitoring for platform: ${detectedPlatform}`, chatOptions);
    const startTime = Date.now();
    const chunks: string[] = [];
    let lastContent = '';
    let lastHeight = 0;
    let stableCount = 0;
    let noChangeCount = 0;
    let lastUpdateTime = startTime;

    try {
      // Wait for message container with multiple selector attempts
      const containerSelectors = [
        chatOptions.messageContainer,
        ...(chatOptions.additionalSelectors?.inputField
          ? [chatOptions.additionalSelectors.inputField]
          : []),
      ].filter(Boolean);

      let containerFound = false;
      for (const selector of containerSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          containerFound = true;
          this.log(`Message container found with selector: ${selector}`);
          break;
        } catch (e) {
          this.log(`Container selector failed: ${selector}`);
        }
      }

      if (!containerFound) {
        throw new Error('No message container found with any selector');
      }

      while (Date.now() - startTime < chatOptions.maxWaitTime) {
        const currentTime: number = Date.now();

        const pageState = await this.page.evaluate(
          (selectors: {
            messageContainer: string;
            typingIndicator: string;
            stopButton: string;
            completedClass: string;
            streamingClass: string;
            additionalSelectors?: {
              loadingSpinner?: string;
            };
          }) => {
            const {
              messageContainer,
              typingIndicator,
              stopButton,
              completedClass,
              streamingClass,
              additionalSelectors,
            } = selectors;

            const containers = document.querySelectorAll(messageContainer);
            const element = containers[containers.length - 1] as HTMLElement | null;

            // Check various indicators
            const indicators = document.querySelectorAll(typingIndicator);
            const typingPresent = Array.from(indicators).some(
              ind =>
                ind &&
                (ind as HTMLElement).offsetParent !== null &&
                !ind.classList.contains('hidden')
            );

            const buttons = document.querySelectorAll(stopButton);
            const stopButtonPresent = Array.from(buttons).some(btn => {
              const button = btn as HTMLButtonElement;
              return button && button.offsetParent !== null && !button.disabled;
            });

            // Enhanced content extraction
            let currentContent = '';
            if (element) {
              // Try multiple content extraction methods
              currentContent =
                element.textContent ||
                element.innerText ||
                element.innerHTML.replace(/<[^>]*>/g, ' ').trim() ||
                '';
            }

            // Check completion states
            const hasCompletedClass = element?.classList.contains(completedClass) || false;
            const hasStreamingClass = element?.classList.contains(streamingClass) || false;
            const isStreaming = hasStreamingClass || typingPresent || stopButtonPresent;

            // Additional state checks
            const hasLoadingSpinner = additionalSelectors?.loadingSpinner
              ? document.querySelector(additionalSelectors.loadingSpinner) !== null
              : false;

            return {
              typingPresent,
              stopButtonPresent,
              currentContent: currentContent.trim(),
              hasCompletedClass,
              hasStreamingClass,
              isStreaming,
              hasLoadingSpinner,
              currentHeight: element ? element.offsetHeight : 0,
              scrollHeight: element ? element.scrollHeight : 0,
              elementCount: containers.length,
            };
          },
          chatOptions
        );

        // Content change detection
        if (pageState.currentContent && pageState.currentContent !== lastContent) {
          const newChunk = pageState.currentContent.slice(lastContent.length);
          if (newChunk.trim()) {
            chunks.push(newChunk);
            this.log(`Chunk received (${newChunk.length} chars)`, {
              totalLength: pageState.currentContent.length,
              isStreaming: pageState.isStreaming,
            });
          }
          lastContent = pageState.currentContent;
          lastHeight = pageState.currentHeight;
          lastUpdateTime = currentTime;
          stableCount = 0;
          noChangeCount = 0;
        } else {
          noChangeCount++;
          if (pageState.currentHeight === lastHeight) {
            stableCount++;
          }
        }

        // Enhanced completion detection
        const timeSinceLastUpdate = currentTime - lastUpdateTime;
        const isDefinitelyComplete =
          pageState.hasCompletedClass ||
          (!pageState.isStreaming &&
            !pageState.hasLoadingSpinner &&
            pageState.currentContent &&
            timeSinceLastUpdate > 2000) ||
          (stableCount >= chatOptions.stableCountThreshold &&
            !pageState.typingPresent &&
            !pageState.stopButtonPresent) ||
          (noChangeCount > 15 && pageState.currentContent && !pageState.isStreaming); // ~3 seconds of no changes

        if (isDefinitelyComplete) {
          const reason = pageState.hasCompletedClass
            ? 'completion-class'
            : !pageState.isStreaming
            ? 'not-streaming'
            : stableCount >= chatOptions.stableCountThreshold
            ? 'content-stable'
            : 'no-activity';

          this.log('Response completed', {
            reason,
            duration: currentTime - startTime,
            contentLength: lastContent.length,
            chunks: chunks.length,
          });
          break;
        }

        await this.sleep(chatOptions.checkInterval);
      }

      const duration = Date.now() - startTime;
      const result: StreamResult = {
        success: true,
        content: lastContent,
        duration,
        chunks,
        metadata: {
          totalChunks: chunks.length,
          averageChunkSize: chunks.length > 0 ? lastContent.length / chunks.length : 0,
          streamEndReason: 'completed',
          platform: detectedPlatform,
        },
      };

      this.log('Wait completed successfully', {
        platform: detectedPlatform,
        duration,
        contentLength: lastContent.length,
        chunks: chunks.length,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.log('Wait failed with error', { error: errorMessage, duration });

      return {
        success: false,
        content: lastContent,
        duration,
        chunks,
        error: errorMessage,
        metadata: {
          totalChunks: chunks.length,
          averageChunkSize: chunks.length > 0 ? lastContent.length / chunks.length : 0,
          streamEndReason: 'error',
          platform: detectedPlatform,
        },
      };
    }
  }

  /**
   * Wait for chatbot to be ready to receive input
   */
  async waitForChatBotReady(timeout: number = 10000): Promise<boolean> {
    const platform = await this.detectPlatform();
    const config = this.getPlatformConfig(platform);

    try {
      // Wait for input field to be available and not disabled
      if (config.additionalSelectors?.inputField) {
        await this.page.waitForFunction(
          (selector: string) => {
            const element = document.querySelector(selector) as
              | HTMLInputElement
              | HTMLTextAreaElement;
            return element && !element.disabled && !element.readOnly;
          },
          { timeout },
          config.additionalSelectors.inputField
        );
      }

      // Wait for send button to be enabled
      if (config.additionalSelectors?.sendButton) {
        await this.page.waitForFunction(
          (selector: string) => {
            const button = document.querySelector(selector) as HTMLButtonElement;
            return button && !button.disabled;
          },
          { timeout },
          config.additionalSelectors.sendButton
        );
      }

      this.log(`Chatbot ready for input (${platform})`);
      return true;
    } catch (error) {
      this.log('Timeout waiting for chatbot ready state', error);
      return false;
    }
  }
}

/*
const waiter = new MultiPlatformChatBotWaiter(page, { 
  debug: true,
  maxWaitTime: 180000, // 3 minutes
  checkInterval: 150 
});
*/

export { MultiPlatformChatBotWaiter, ChatBotStreamOptions, StreamResult };
