#!/bin/bash

# Create the queue
echo "Creating SQS queue..."
awslocal sqs create-queue --queue-name scraper-queue --region ap-south-1

# List queues to verify
echo "Listing queues:"
awslocal sqs list-queues --region ap-south-1

# Test the API
echo -e "\nTesting API..."
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://en.wikipedia.org/wiki/Node.js"}'

echo -e "\nListing messages in the queue:"
QUEUE_URL=$(awslocal sqs get-queue-url --queue-name scraper-queue --query 'QueueUrl' --output text --region ap-south-1)
awslocal sqs receive-message --queue-url $QUEUE_URL --region ap-south_1
