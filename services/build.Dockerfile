FROM node:18-alpine

ARG service_folder

WORKDIR /usr/src/app/services/

COPY ./services/.swcrc ./

COPY ./services/${service_folder} ./${service_folder}/

RUN cd ${service_folder} && \
    yarn tsc -p ./tsconfig.build.json --noEmit && \
    yarn run -T swc . -d ./dist && \
    yarn workspaces focus --production ${service_folder}
