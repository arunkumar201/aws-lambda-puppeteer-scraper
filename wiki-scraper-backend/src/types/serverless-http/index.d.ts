import { type Application } from 'express';
import { type Handler, type Context } from 'aws-lambda';

declare function serverlessHttp(
  app: Application,
  options?: {
    binary?: boolean | string[] | { isBinary?: (headers: Record<string, string>) => boolean };
    request?: (req: any, event: any, context: Context) => void;
    response?: (res: any) => void;
  }
): Handler;

export = serverlessHttp;
