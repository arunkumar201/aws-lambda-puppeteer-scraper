/* eslint-disable no-console */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { v4 as uuidv4 } from 'uuid';
import { WikipediaJobSchema, NewsJobSchema, ScrapeAction } from './types/job.types';
import { logger } from './utils/logger';

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const QUEUE_URL = process.env.QUEUE_URL || '';

const siteSchemas = {
  wikipedia: WikipediaJobSchema,
  news: NewsJobSchema,
};

type SiteType = keyof typeof siteSchemas;

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
    const { site_type, ...rest } = requestBody;

    const schema = siteSchemas[site_type as SiteType];
    if (!schema) {
      logger.warn(`Unknown site_type received: ${site_type}`);
      return respond(400, { message: 'Unknown site_type' });
    }

    const parsed = schema.safeParse(rest);
    if (!parsed.success) {
      logger.error('Invalid input for job:', { errors: parsed.error.errors });
      return respond(400, { message: 'Invalid input', errors: parsed.error.errors });
    }

    const job: ScrapeAction = {
      action: site_type as SiteType,
      payload: { ...parsed.data, job_id: uuidv4() },
    };

    logger.info('Queueing job:', { job });

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(job),
      })
    );

    return respond(200, { message: 'Job queued', job_id: job.payload.job_id, site_type });
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
