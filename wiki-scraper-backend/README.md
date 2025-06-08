# Wikipedia Scraper Backend

A scalable TypeScript backend for scraping Wikipedia pages, taking screenshots, and storing them in AWS S3. The application is built with Express, TypeScript, and can be deployed as a serverless function on AWS Lambda.

## Features

- 🚀 Scrape Wikipedia pages with Puppeteer
- 📸 Take full-page screenshots
- ☁️ Store screenshots in AWS S3
- 📝 API documentation with Swagger
- 🔒 Input validation with Zod
- 🛡️ Security best practices (Helmet, rate limiting, CORS)
- 🧪 Unit and integration testing
- 📦 AWS Lambda ready
- 🐳 Docker support for local development

## Prerequisites

- Node.js 18.x or later
- pnpm 8.x or later
- AWS Account with appropriate permissions
- AWS CLI configured with credentials
- Docker (for local testing with AWS SAM)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/wiki-scraper-backend.git
cd wiki-scraper-backend
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

Copy the example environment file and update the values:

```bash
cp .env.example .env
```

Edit the `.env` file with your AWS credentials and other configuration.

### 4. Local Development

Start the development server with hot-reload:

```bash
pnpm dev
```

The API will be available at `http://localhost:3001`

### 5. Build for Production

```bash
pnpm build
```

### 6. Run Tests

```bash
pnpm test
```

## API Documentation

Once the server is running, you can access the API documentation at:

- Swagger UI: `http://localhost:3001/api-docs`
- OpenAPI JSON: `http://localhost:3001/docs.json`

## Available Scripts

- `pnpm dev` - Start development server with hot-reload
- `pnpm build` - Build the application for production
- `pnpm start` - Start the production server
- `pnpm test` - Run tests
- `pnpm lint` - Lint the code
- `pnpm format` - Format the code
- `pnpm deploy` - Deploy to AWS using SAM

## Project Structure

```
src/
├── config/           # Configuration files
├── controllers/       # Request handlers
├── middlewares/       # Express middlewares
├── models/            # Data models
├── routes/            # Route definitions
├── services/          # Business logic
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
├── app.ts             # Express application setup
├── index.ts           # Application entry point
└── lambda.ts          # AWS Lambda handler
```

## Deployment

### Prerequisites

- AWS CLI configured with appropriate credentials
- AWS SAM CLI installed
- Docker running (for local testing)

### 1. Build the application

```bash
pnpm build
```

### 2. Package and deploy with SAM

```bash
# Build the SAM application
sam build

# Deploy to AWS
sam deploy --guided
```

Follow the interactive prompts to complete the deployment.

### 3. After Deployment

After successful deployment, you'll receive the API Gateway URL in the outputs. Use this URL to access your API.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Node environment | `development` |
| PORT | Port to run the server | `3001` |
| AWS_ACCESS_KEY_ID | AWS access key ID | - |
| AWS_SECRET_ACCESS_KEY | AWS secret access key | - |
| AWS_REGION | AWS region | `ap-south-1` |
| S3_BUCKET_NAME | S3 bucket name for screenshots | - |
| S3_SIGNED_URL_EXPIRY | Expiry time for S3 signed URLs (seconds) | `3600` |
| CORS_ORIGIN | Allowed CORS origins | `*` |
| LOG_LEVEL | Logging level | `info` |
| LOG_DIR | Directory for log files | `logs` |
| RATE_LIMIT_MAX | Maximum requests per window | `100` |
| RATE_LIMIT_WINDOW_MS | Rate limit window in milliseconds | `900000` (15 minutes) |

## API Endpoints

### Scrape Wikipedia Page

- **URL**: `POST /api/wiki/scrape`
- **Request Body**:
  ```json
  {
    "url": "https://en.wikipedia.org/wiki/Large_language_model"
  }
  ```
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "title": "Large language model - Wikipedia",
      "content": "...",
      "sections": [...],
      "screenshotUrl": "https://your-bucket.s3.region.amazonaws.com/screenshots/1234567890-example.jpg"
    }
  }
  ```

## API Flow for Local Testing

### Batch Scraping Endpoint

**POST** `/api/scrape`

Accepts a batch of scraping jobs, each specifying an `action` (e.g., `wikipedia`, `news`) and a `payload` (site-specific job data).

#### Request Body Example
```json
{
  "jobs": [
    {
      "action": "wikipedia",
      "payload": {
        "user_id": "user123",
        "url": "https://en.wikipedia.org/wiki/Node.js"
      }
    },
    {
      "action": "news",
      "payload": {
        "user_id": "user456",
        "url": "https://news.ycombinator.com/"
      }
    }
  ]
}
```

#### Response Example
```json
{
  "results": [
    {
      "action": "wikipedia",
      "success": true,
      "data": {
        "screenshotKey": "https://your-bucket.s3.amazonaws.com/screenshots/jobid.png",
        "markdown": "...",
        "links": ["https://...", ...]
      }
    },
    {
      "action": "news",
      "success": true,
      "data": {
        "screenshotKey": "https://your-bucket.s3.amazonaws.com/screenshots/jobid.png",
        "markdown": "...",
        "links": ["https://...", ...]
      }
    }
  ]
}
```

#### Example cURL Command
```sh
curl -X POST http://localhost:3001/api/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "jobs": [
      { "action": "wikipedia", "payload": { "user_id": "user123", "url": "https://en.wikipedia.org/wiki/Node.js" } },
      { "action": "news", "payload": { "user_id": "user456", "url": "https://news.ycombinator.com/" } }
    ]
  }'
```

- Each job result includes `success`, `data` (on success), or `error` (on failure).
- The `screenshotKey` is a public S3 URL to the screenshot.
- The `markdown` and `links` fields contain extracted content.

---

For more details, see the code in `src/app.ts`, `src/types/scrape.types.ts`, and the scrapers in `src/scraper/`.


## Monitoring and Logging

- **Local Logs**: Logs are written to the `logs/` directory
- **CloudWatch Logs**: When deployed to AWS, logs are available in CloudWatch

## Security

- Input validation with Zod
- Helmet for security headers
- Rate limiting
- CORS protection
- Environment-based configuration
- No sensitive data in version control

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Express](https://expressjs.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Puppeteer](https://pptr.dev/)
- [AWS SDK v3](https://aws.amazon.com/sdk-for-javascript/)
- [Zod](https://zod.dev/)
- [Swagger](https://swagger.io/)
