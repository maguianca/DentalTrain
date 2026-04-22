FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

RUN mkdir -p /usr/share/nginx/html/app/chatbot

COPY dist /usr/share/nginx/html/app/chatbot

RUN sed -i 's/listen       80;/listen       8100;/g' /etc/nginx/conf.d/default.conf

EXPOSE 8100

CMD ["nginx", "-g", "daemon off;"]