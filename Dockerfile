FROM node:alpine3.10
RUN npm install express
WORKDIR /app
ADD ./service.js /app
EXPOSE 3000
ENTRYPOINT [ "node", "service.js" ]