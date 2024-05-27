#syntax=docker/dockerfile:1.4

ARG BASE_IMAGE
FROM ${BASE_IMAGE} AS base
FROM node:20-alpine AS service-builder

RUN corepack enable && corepack prepare yarn@stable --activate

ARG service_folder

WORKDIR /usr/src/repo/

COPY --from=base  /usr/src/repo /usr/src/repo

COPY services/.swcrc services/.swcrc

COPY services/ ./

ENV YARN_ENABLE_OFFLINE_MODE=1

RUN cd services/${service_folder} && \
    yarn typecheck && \
    yarn build && \
    yarn workspaces focus --production @effective-tasklist/service_${service_folder}
