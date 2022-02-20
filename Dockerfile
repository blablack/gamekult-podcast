FROM node:12.22.5-slim
COPY . .
RUN npm install
CMD [ "node", "app.js" ]