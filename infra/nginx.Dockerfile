FROM nginxinc/nginx-unprivileged

USER root
ARG DOCROOT=/usr/share/nginx/html
COPY --chown=nobody:nobody . ${DOCROOT}
RUN find ${DOCROOT} -type d -print0 | xargs -0 chmod 755 && \
    find ${DOCROOT} -type f -print0 | xargs -0 chmod 644 && \
    chmod 755 ${DOCROOT}

RUN echo '<!DOCTYPE html><html><head><script src="/ipinfo.js"></script></head><body><h1>EffectiveTasklist:<div id="ip"></div></h1></body></html>' > /usr/share/nginx/html/index.html && \
    echo '(fetch("https://ipinfo.io/ip").then((resp) => resp.text()).then((ip) => (document.getElementById("ip").innerText = ip)))();' > /usr/share/nginx/html/ipinfo.js

USER nginx

CMD ["nginx", "-g", "daemon off;"]