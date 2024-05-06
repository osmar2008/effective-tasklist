FROM nginx:alpine

RUN echo "<h1>Effective Tasklist</h1>" > /usr/share/nginx/html/index.html && \
    sed -i s/80/8080/g /etc/nginx/conf.d/default.conf 

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]