FROM node:lts-alpine as base
LABEL authors="osmar"

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY . .

RUN corepack enable && yarn

