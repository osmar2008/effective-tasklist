FROM effective-tasklist:base-latest

ARG service_folder

WORKDIR /usr/src/app/services/

COPY eslint.config.js .
COPY ./${service_folder}/* ./${service_folder}/.swcrc ./${service_folder}/

RUN yarn eslint ${service_folder} --fix && \
    yarn tsc -p ./${service_folder}/tsconfig.build.json --noEmit && \
    cd ${service_folder} && \
    yarn run -T swc . -d ./dist && \
    yarn workspaces focus --production ${service_folder}
