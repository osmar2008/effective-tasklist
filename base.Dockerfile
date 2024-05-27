FROM node:20-alpine as base
LABEL authors="osmar"

# Create app directory
WORKDIR /usr/src/repo

RUN corepack enable && corepack prepare yarn@stable --activate

# Install app dependencies
COPY . .

RUN --mount=type=cache,target=/usr/src/repo/.yarn,id=yarn_cache yarn install --immutable