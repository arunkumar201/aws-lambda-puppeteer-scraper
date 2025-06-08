import * as fs from 'fs';
import * as path from 'path';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import logger from './logger';
import config from '../config/config';

export interface UploadS3Params {
  bucket: string;
  key: string;
  body: Buffer | string;
  contentType: string;
}

export class S3Helper {
  private readonly s3: S3Client;
  private region: string;
  constructor(region: string) {
    this.region = region;
    this.s3 = new S3Client({
      region,
    });
  }

  /**
   * Uploads a file to S3 and returns the key.
   * @param params - The upload parameters including bucket, key, body and content type
   * @returns The S3 key of the uploaded file or local URL
   * @throws Error if upload fails
   */
  public async uploadS3Local(params: UploadS3Params, shouldSaveLocally = false): Promise<string> {
    try {
      if (!shouldSaveLocally) {
        const putParams: PutObjectCommandInput = {
          Bucket: params.bucket,
          Key: params.key,
          Body: params.body,
          ContentType: params.contentType,
          ACL: 'public-read',
        };
        await this.s3.send(new PutObjectCommand(putParams));
        logger.info(`Successfully uploaded file to S3: ${params.key}- ${this.region}`);
        const url = `https://${params.bucket}.s3.${this.region}.amazonaws.com/${params.key}`;
        return url;
      }
    } catch (error) {
      logger.error(
        `Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Fallback to local save
    const localUrl = await saveFileLocally(params.key, params.body);
    return localUrl;
  }
}

async function saveFileLocally(key: string, body: Buffer | string): Promise<string> {
  const publicPath = path.resolve(process.cwd(), 'public');
  logger.info(`Resolved public path: ${publicPath}`);
  const filePath = path.join(publicPath, key);
  const directoryPath = path.dirname(filePath);

  try {
    await fs.promises.mkdir(directoryPath, { recursive: true });
    await fs.promises.writeFile(filePath, body);
    logger.info(`File saved locally at: ${filePath}`);

    // Return relative URL path instead of full file system path
    // Since web server serves static files from 'public' directory,
    // we return the path relative to public directory
    const relativeUrl = `/${key}`;
    return relativeUrl;
  } catch (err) {
    logger.error(
      `Failed to save file locally: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
    throw new Error(
      `Failed to save file locally: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
}
