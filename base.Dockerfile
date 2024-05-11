FROM node:20-alpine as base
LABEL authors="osmar"

# Create app directory
WORKDIR /usr/src/app

RUN corepack enable

# Install app dependencies
COPY . .

RUN --mount=type=cache,target=/usr/src/app/.yarn,id=yarn_cache yarn install --immutable
