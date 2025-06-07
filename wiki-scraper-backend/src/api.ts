import { APIGatewayProxyEvent,APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient,SendMessageCommand } from '@aws-sdk/client-sqs';
import { v4 as uuidv4 } from 'uuid';
// import { logger } from './utils/logger';

const logger = console;

const sqs = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1'
});
const QUEUE_URL = process.env.QUEUE_URL || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info('Received API request',{ event });
  console.log('Received event:',JSON.stringify(event,null,2));

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: '',
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Request body is required' }),
      };
    }

    const { url } = JSON.parse(event.body);

    if (!url) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'URL is required in the request body' }),
      };
    }

    const messageId = uuidv4();
    const params = {
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({
        id: messageId,
        url,
        timestamp: new Date().toISOString(),
      }),
      MessageGroupId: 'scraper-tasks',
      MessageDeduplicationId: messageId,
    };

    await sqs.send(new SendMessageCommand(params));

    logger.info('Successfully queued scraping task',{ messageId,url });

    return {
      statusCode: 202,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Scraping task queued successfully',
        taskId: messageId,
        statusUrl: `/status/${messageId}`,
      }),
    };
  } catch (error) {
    logger.error('Error processing request',{ error });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
