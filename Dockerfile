FROM node:8

WORKDIR /opt

ADD ./*.json /opt/
RUN npm install

ADD . /opt/
CMD ["node", "/opt/index.js"]
EXPOSE 80
