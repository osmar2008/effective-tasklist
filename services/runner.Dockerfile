FROM effective-tasklist:build-latest as build

FROM node:alpine

ARG service_folder

WORKDIR /usr/src/app

USER node

COPY --from=build /usr/src/app/node_modules/ ./node_modules/
COPY --from=build /usr/src/app/services/${service_folder}/package.json ./${service_folder}/
COPY --from=build /usr/src/app/services/${service_folder}/dist/ ./${service_folder}/

WORKDIR /usr/src/app/${service_folder}

CMD ["node", "dist/main.js"]
