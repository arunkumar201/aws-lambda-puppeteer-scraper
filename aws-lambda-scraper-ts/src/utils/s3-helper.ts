import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand, PutObjectCommandInput, GetObjectCommand } from '@aws-sdk/client-s3';
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
   * @returns The S3 key of the uploaded file
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
    const localPath = await saveFileLocally(params.key, params.body);
    return localPath;
  }
}

async function saveFileLocally(key: string, body: Buffer | string): Promise<string> {
  const publicPath = path.resolve(__dirname, '../../public/uploads');
  const filePath = path.join(publicPath, key);

  try {
    await fs.promises.mkdir(publicPath, { recursive: true });
    await fs.promises.writeFile(filePath, body);
    logger.info(`File saved locally at: ${filePath}`);
    return filePath;
  } catch (err) {
    logger.error(
      `Failed to save file locally: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
    return '';
  }
}
