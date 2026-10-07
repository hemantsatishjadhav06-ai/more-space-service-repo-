FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# The reviewed static build is committed with the source. No npm install is needed.
COPY --chown=node:node dist/ ./dist/
COPY --chown=node:node content/site-counts.json ./content/site-counts.json
COPY --chown=node:node dev-server.mjs ./dev-server.mjs

USER node
EXPOSE 3000
CMD ["node", "dev-server.mjs"]
