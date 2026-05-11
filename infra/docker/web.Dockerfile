FROM node:20-alpine
WORKDIR /app
COPY web /app
CMD ["sh"]
