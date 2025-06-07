import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import serverless from 'serverless-http';
import app from './app';

// Create a serverless-http handler with proper typing
type ServerlessHandler = (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>;
const serverlessHandler = serverless(app) as unknown as ServerlessHandler;

// Lambda handler function
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Set a longer timeout for the Lambda function
  context.callbackWaitsForEmptyEventLoop = false;
  
  try {
    // Get the response from the serverless handler
    const response = await serverlessHandler(event, context);
    
    // Ensure headers exist
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      ...(response.headers || {})
    };
    
    // Return the response with CORS headers
    return {
      statusCode: response.statusCode || 200,
      headers,
      body: response.body || '',
      isBase64Encoded: response.isBase64Encoded || false
    };
  } catch (error: unknown) {
    console.error('Error in Lambda handler:', error);
    
    // Get error message safely
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unknown error occurred';
    
    // Return a proper error response
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      })
    };
  }
};

// Local development handler
export const local = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  // For local development, we can add additional logging or behavior
  console.log('Local execution:', { event });
  return handler(event, context);
};
