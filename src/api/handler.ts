import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { WikipediaJobSchema, NewsJobSchema } from '../types/job.types';

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const QUEUE_URL = process.env.QUEUE_URL || '';

const siteSchemas = {
  wikipedia: WikipediaJobSchema,
  news: NewsJobSchema,
};

type SiteType = keyof typeof siteSchemas;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (!event.body) return respond(400, { message: 'Request body is required' });

  const { site_type, ...rest } = JSON.parse(event.body);
  const schema = siteSchemas[site_type as SiteType];
  if (!schema) return respond(400, { message: 'Unknown site_type' });

  const parsed = schema.safeParse(rest);
  if (!parsed.success)
    return respond(400, { message: 'Invalid input', errors: parsed.error.errors });

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({ site_type, ...parsed.data }),
    })
  );

  return respond(200, { message: 'Job queued', site_type });
};

function respond(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}
