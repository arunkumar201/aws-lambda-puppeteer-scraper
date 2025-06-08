/* eslint-disable no-console */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { v4 as uuidv4 } from 'uuid';
import {
  ScrapeAction,
  ScrapeActionSchema,
  ScrapeBatchRequestSchema,
  ScrapeBatchRequest,
} from './types/job.types';
import { logger } from './utils/logger';

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const QUEUE_URL = process.env.QUEUE_URL || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info('Received event:', { body: event.body });

  try {
    if (event.httpMethod === 'OPTIONS') {
      return respond(200, {});
    }

    if (!event.body) {
      return respond(400, { message: 'Request body is required' });
    }

    const requestBody = JSON.parse(event.body);

    // Try to parse as a batch request (array of jobs)
    const batchParsed = ScrapeBatchRequestSchema.safeParse(requestBody);

    if (batchParsed.success) {
      const jobsToQueue: ScrapeAction[] = batchParsed.data.map(job => ({
        ...job,
        job_id: job.job_id || uuidv4(), // Assign job_id if not provided
      }));

      logger.info(`Queueing ${jobsToQueue.length} jobs in batch.`, { jobs: jobsToQueue });

      await Promise.all(
        jobsToQueue.map(async job => {
          await sqs.send(
            new SendMessageCommand({
              QueueUrl: QUEUE_URL,
              MessageBody: JSON.stringify(job),
            })
          );
        })
      );

      return respond(200, {
        message: `Queued ${jobsToQueue.length} jobs`,
        job_ids: jobsToQueue.map(job => job.job_id),
      });
    }

    // If not a batch, try to parse as a single job
    const singleParsed = ScrapeActionSchema.safeParse(requestBody);

    if (!singleParsed.success) {
      logger.error('Invalid input: Not a single job or batch request.', {
        singleErrors: singleParsed.error.errors,
        // If batchParsed failed too, include its errors for more context
        batchErrors: batchParsed.success ? undefined : batchParsed.error.errors,
      });
      return respond(400, { message: 'Invalid input', errors: singleParsed.error.errors });
    }

    const job: ScrapeAction = {
      ...singleParsed.data,
      job_id: singleParsed.data.job_id || uuidv4(),
    }; // Assign job_id if not provided

    logger.info('Queueing single job:', { job });

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(job),
      })
    );

    return respond(200, { message: 'Job queued', job_id: job.job_id, site_type: job.site_type });
  } catch (error) {
    logger.error('Error processing API request:', { error });
    return respond(500, {
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

function respond(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify(body),
  };
}
