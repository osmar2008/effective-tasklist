#syntax=docker/dockerfile:1.4

ARG BASE_IMAGE
FROM ${BASE_IMAGE} AS base
FROM node:20-alpine AS service-builder

RUN corepack enable && corepack prepare yarn@stable --activate

ARG service_folder

WORKDIR /usr/src/repo/

COPY --from=base  /usr/src/repo /usr/src/repo

COPY ./services ./services

ENV YARN_ENABLE_OFFLINE_MODE=1
ENV NODE_ENV=production

RUN cd services/${service_folder} && \
    yarn typecheck && \
    yarn build

FROM service-builder as service-test-runner

ARG service_folder
ARG BASE_POINT

WORKDIR /usr/src/repo/

RUN yarn workspaces foreach -Rpt  --since=${BASE_POINT} run test


FROM node:20-alpine AS service-runner

ARG service_folder

WORKDIR /usr/src/app/

COPY --from=service-builder /usr/src/repo/services/${service_folder}/dist /usr/src/repo/node_modules /usr/src/app/

CMD ["node", "main.mjs"]