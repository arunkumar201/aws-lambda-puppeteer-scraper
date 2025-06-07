#!/bin/bash
set -x

# Create SQS queue
awslocal sqs create-queue --queue-name scraper-queue --region ap-south-1

# List queues to verify
awslocal sqs list-queues --region ap-south-1
