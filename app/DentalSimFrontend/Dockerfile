FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
RUN rm -rf /usr/share/nginx/html/*

RUN mkdir -p /usr/share/nginx/html/app/chatbot

COPY dist /usr/share/nginx/html/app/chatbot

COPY nginx.conf /etc/nginx/conf.d/

EXPOSE 8100

CMD ["nginx", "-g", "daemon off;"]
