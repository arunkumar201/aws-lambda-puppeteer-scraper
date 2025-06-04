# 🚀 Wikipedia LLM Scraper with AWS Lambda

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)](https://nodejs.org/)
[![AWS](https://img.shields.io/badge/AWS-Lambda-FF9900?logo=amazonaws)](https://aws.amazon.com/lambda/)
[![pnpm](https://img.shields.io/badge/pnpm-8%2B-pink?logo=pnpm)](https://pnpm.io/)

A serverless application that scrapes the Wikipedia page about Large Language Models (LLMs) using Puppeteer in an AWS Lambda function, captures a screenshot, and uploads it to an S3 bucket.

## ✨ Features

- 🌐 Scrapes content from Wikipedia's Large Language Model page
- 📸 Takes full-page screenshots
- ☁️ Uploads screenshots to S3 with automatic cleanup (30-day retention)
- ⏰ Scheduled to run daily using AWS EventBridge
- 🔄 Returns structured JSON with scraped content and screenshot URL
- 🐳 Local development with Docker

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [pnpm](https://pnpm.io/) v8 or later
- [AWS CLI](https://aws.amazon.com/cli/) v2.x configured with appropriate permissions
- [AWS SAM CLI](https://aws.amazon.com/serverless/sam/)
- [Docker](https://www.docker.com/) (for local testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/arunkumar201/aws-lambda-puppeteer.git
cd aws-lambda-puppeteer

# Install dependencies using pnpm
cd browser-function
pnpm install

# Install AWS SAM CLI (if not already installed)
pip install --user aws-sam-cli
```

## 🛠️ Development

### Local Testing

1. **Build the function**

   ```bash
   sam build
   ```

2. **Run locally**

   ```bash
   # Using pnpm script
   pnpm local

   # Or directly with SAM
   sam local invoke WikipediaScraperFunction -e event.json --debug
   ```

### Environment Variables

Create a `.env` file in the root directory:

```env
AWS_REGION=your-aws-region
S3_BUCKET_NAME=your-s3-bucket-name
```

## ☁️ Deployment

1. **Build the application**

   ```bash
   sam build
   ```

2. **Deploy to AWS**

   ```bash
   sam deploy --guided
   ```

   Follow the interactive prompts to configure your deployment.

3. **Verify deployment**
   Check the CloudFormation stack in the AWS Console for deployment status and outputs.

## 📁 Project Structure

    npm install
    ```

## Build and Deploy with AWS SAM

AWS SAM (Serverless Application Model) is a framework used for building and deploying serverless applications. To deploy this Lambda function using SAM, follow these steps:

### Create an S3 Bucket

Before deploying your application, you need to create an S3 bucket to store the deployment artifacts. You can create a new S3 bucket using the AWS CLI:

```bash
aws s3 mb s3://your-s3-bucket-name
```

Replace `your-s3-bucket-name` with a unique name for your S3 bucket. Make sure to define this bucket name in the `template.yaml` file under the `Deploy` section.

### Validate the SAM Template

Before building, you can validate your SAM template to ensure everything is correct:

```bash
sam validate
```

### Build the Project

Build the Lambda function using SAM:

```bash
sam build
```

This command packages your application and prepares it for deployment.

### Deploy the Lambda Function

Deploy the function to AWS:

```bash
sam deploy --guided
```

This command will guide you through the deployment process, where you can specify:

- Stack Name
- AWS Region
- S3 Bucket for deployment artifacts (use the bucket name you created earlier)
- Whether to allow SAM to create IAM roles for your functions

During this process, SAM will upload your deployment artifacts to the specified S3 bucket and create the necessary AWS resources defined in your `template.yaml`.

### Example Usage

Once deployed, the Lambda function can be triggered according to the schedule defined in the `template.yaml`. By default, it runs every 30 minutes. The function will perform the following actions:

- Navigate to `https://github.com`
- Take a screenshot of the page
- (Optional) Generate a PDF of the page
- (Optional) Extract text from the page
- (Optional) Take a screenshot of a specific element

### Viewing Logs

To view the logs for your Lambda function, use the following command:

```bash
sam logs -n BrowserFunction --stack-name <your-stack-name> --tail
```

Replace `<your-stack-name>` with the name of your stack.

## Cleaning Up

To delete the deployed stack and all associated resources:

```bash
sam delete --stack-name <your-stack-name>
```

This command will remove the CloudFormation stack, including the Lambda function, IAM roles, and other resources.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Author

### [Arun Kumar](https://github.com/arunkumar201)
