# Deployment Guide for Wikipedia Scraper Backend

This guide provides step-by-step instructions for deploying the Wikipedia Scraper Backend to AWS using AWS SAM.

## Prerequisites

1. AWS Account with appropriate permissions
2. AWS CLI installed and configured with credentials
3. AWS SAM CLI installed
4. Node.js 18.x or later
5. pnpm 8.x or later

## Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/arunkumar201/aws-lambda-puppeteer.git
   cd aws-lambda-puppeteer/wiki-scraper-backend
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create a `.env` file with the from `.env.example` file


## Building the Application

1. Build the Lambda deployment package:
   ```bash
   pnpm run lambda:build
   ```

   This script (`deploy.sh`) will:
   - Clean the `dist` directory.
   - Compile TypeScript to JavaScript.
   - Install production dependencies in `dist/`.

## Deploying with AWS SAM

### First-time Deployment

For the first deployment, use the guided deployment:

```bash
pnpm run lambda:deploy:guided
```

Follow the interactive prompts to provide:
- Stack Name: `aws-lambda-puppeteer-scraper`
- AWS Region: (your preferred region)
- Environment: `dev`, `staging`, or `prod`
- Confirm changes before deploy: `y`
- Allow SAM CLI IAM role creation: `y`
- Disable rollback: `n`
- Save arguments to configuration file: `y`

### Subsequent Deployments

For subsequent deployments, you can use:

```bash
pnpm run lambda:deploy
```

This will use the configuration from `samconfig.toml`.

## Testing the Deployment

1. Get the API Gateway URL from the CloudFormation outputs
2. Send a POST request to the `/scrape` endpoint:
   
   **Single Job Request Example:**
   ```bash
   curl -X POST \
     https://YOUR_API_ID.execute-api.REGION.amazonaws.com/prod/scrape \
     -H 'Content-Type: application/json' \
     -d '{ "site_type": "wikipedia", "user_id": "test_user", "url": "https://en.wikipedia.org/wiki/Node.js", "metadata": { "source": "api-gateway", "priority": "high" } }'
   ```

   **Batch Job Request Example:**
   ```bash
   curl -X POST \
     https://YOUR_API_ID.execute-api.REGION.amazonaws.com/prod/scrape \
     -H 'Content-Type: application/json' \
     -d '[
       { "site_type": "wikipedia", "user_id": "user1", "url": "https://en.wikipedia.org/wiki/Python", "metadata": { "source": "api-gateway", "priority": "high" } },
       { "site_type": "news", "user_id": "user2", "url": "https://www.cnn.com/", "metadata": { "source": "api-gateway", "priority": "low" } }
     ]'
   ```

## Monitoring

1. **CloudWatch Logs**: Check the logs for each Lambda function in the AWS Console
2. **SQS Queue**: Monitor the queue in the SQS Console
3. **S3 Bucket**: Verify screenshots are being saved correctly

## Cleanup

To delete the stack and all resources:

```bash
aws cloudformation delete-stack --stack-name aws-lambda-puppeteer-scraper
```

## Troubleshooting

### Common Issues

1. **Deployment Fails with IAM Errors**
   - Ensure your IAM user has sufficient permissions
   - Check CloudFormation events for specific error messages

2. **Lambda Timeout**
   - Increase the timeout in `template.yaml`
   - Optimize the Puppeteer script if needed

3. **S3 Access Denied**
   - Verify the IAM role has the correct S3 permissions
   - Check bucket policies

4. **Chromium Not Found**
   - Ensure the Lambda layer with Chromium is correctly referenced
   - Check the Lambda execution role has permission to access the layer

## Security Considerations

1. **IAM Roles**: Use the principle of least privilege
2. **Environment Variables**: Store sensitive data in AWS Systems Manager Parameter Store or AWS Secrets Manager
3. **API Gateway**: Enable API key and usage plans for production
4. **S3**: Enable bucket encryption and versioning

## Cost Optimization

1. **S3 Lifecycle Rules**: Automate cleanup of old screenshots
2. **Lambda Concurrency**: Set appropriate concurrency limits
3. **SQS**: Set appropriate message retention periods

For more information, refer to the [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html).
