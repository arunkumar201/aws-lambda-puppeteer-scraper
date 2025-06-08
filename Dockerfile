FROM public.ecr.aws/sam/build-nodejs20.x:latest

WORKDIR /var/task

# Install dependencies
COPY package*.json ./
RUN npm install

# Create logs directory
RUN mkdir -p /var/task/logs

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Install SAM CLI
RUN pip install --upgrade pip && \
    pip install --upgrade aws-sam-cli

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["sh", "-c", "sam local start-api --docker-network wiki-scraper_default --host 0.0.0.0 --port 3000"]
