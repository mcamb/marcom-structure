ARG SOFTWARE_VERSION_TAG
FROM node:${SOFTWARE_VERSION_TAG}
WORKDIR /app
COPY package.json *.js  ./
RUN npm install
EXPOSE 3000
CMD ["node", "index.js"]
