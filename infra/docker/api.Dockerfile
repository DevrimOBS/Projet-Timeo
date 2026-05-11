FROM node:20-alpine
WORKDIR /app
COPY api /app
CMD ["sh"]
