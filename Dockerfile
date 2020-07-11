FROM node:14-alpine

# Prepare package registry
RUN npm config set registry http://mirrors.cloud.tencent.com/npm/

# Prepare working directory
RUN mkdir -p /usr/src/dmq-bot

# Set working directory
WORKDIR /usr/src/dmq-bot

# Install dependencies
COPY package.json package-lock.json /usr/src/dmq-bot/
RUN cd /usr/src/dmq-bot
RUN npm install
RUN npm install -g pm2@latest

# Copy programs
COPY . /usr/src/dmq-bot

# Start services
CMD pm2 start /usr/src/dmq-bot/ecosystem.config.js \
    && pm2 logs "/(danmaqua-bot|dmsrc-bilibili|dmsrc-douyu)/"

