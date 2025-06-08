import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../src/utils/logger';

interface PollSqsConfig {
  queueUrl: string;
  region?: string;
  outputFile?: string;
}

class SqsPoller {
  private readonly sqs: SQSClient;
  private readonly queueUrl: string;
  private readonly outputFile: string;
  private responseData: any[] = [];

  constructor(config: PollSqsConfig) {
    this.sqs = new SQSClient({ region: config.region || 'ap-south-1' });
    this.queueUrl = config.queueUrl;
    this.outputFile = config.outputFile || path.join(__dirname, 'response-queue.json');
  }

  private async loadExistingResponses(): Promise<void> {
    try {
      const data = await fs.readFile(this.outputFile, 'utf-8');
      this.responseData = JSON.parse(data);

      logger.info('✅ Loaded existing responses', {
        count: this.responseData.length,
        file: this.outputFile,
      });
    } catch (err) {
      logger.warn('⚠️ No existing response file found. Starting fresh.', {
        error: err,
      });
      this.responseData = [];
    }
  }

  private async appendResponseToFile(): Promise<void> {
    try {
      await fs.writeFile(this.outputFile, JSON.stringify(this.responseData, null, 2));

      logger.info('📦 Appended new response to file', {
        totalResponses: this.responseData.length,
      });
    } catch (err) {
      logger.error('❌ Failed to write responses to file', {
        error: err,
      });
      throw err;
    }
  }

  private async pollQueue(): Promise<void> {
    logger.info('🔄 Polling SQS queue...');

    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 4,
    });

    try {
      const result = await this.sqs.send(command);

      if (result.Messages && result.Messages.length > 0) {
        const message = result.Messages[0];
        const body = message.Body;

        try {
          const parsed = JSON.parse(body!);

          logger.info('📥 Message received and parsed', {
            messageId: message.MessageId,
            jobId: parsed.job_id,
            action: parsed.action,
          });

          this.responseData.push(parsed);
          await this.appendResponseToFile();
        } catch (parseErr) {
          const badMessageFile = path.join(__dirname, `bad-message-${Date.now()}.txt`);

          logger.error('🛑 JSON parse failed for message', {
            error: parseErr,
            messageId: message.MessageId,
            outputFile: badMessageFile,
          });

          await fs.writeFile(badMessageFile, body || '');
        }

        try {
          await this.sqs.send(
            new DeleteMessageCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: message.ReceiptHandle!,
            })
          );

          logger.info('🗑️ Deleted message from queue', {
            messageId: message.MessageId,
          });
        } catch (deleteErr) {
          logger.error('❌ Failed to delete message from SQS', {
            error: deleteErr,
            messageId: message.MessageId,
          });
        }
      } else {
        logger.info('📭 No messages currently in queue');
      }
    } catch (err) {
      logger.error('❌ Error while polling SQS queue', {
        error: err,
      });
    }
  }

  public async start(): Promise<void> {
    logger.info('🚀 SQS Polling Service Started');

    await this.loadExistingResponses();

    while (true) {
      await this.pollQueue();
      logger.info('⏳ Waiting 5 seconds before next poll...');
      await new Promise(res => setTimeout(res, 5000));
    }
  }
}

const getQueueUrl = (): string | undefined => {
  const queueUrlIndex = process.argv.indexOf('--queue-url');
  if (queueUrlIndex > -1 && process.argv.length > queueUrlIndex + 1) {
    return process.argv[queueUrlIndex + 1];
  }
  return undefined;
};

const queueUrl = getQueueUrl();
if (!queueUrl) {
  logger.error(
    '❌ Queue URL is required as a command line argument (e.g., --queue-url <YOUR_QUEUE_URL>)'
  );
  process.exit(1);
}

const poller = new SqsPoller({ queueUrl });
poller.start().catch(err => {
  logger.error('💥 Fatal error in main loop', { error: err });
  process.exit(1);
});
