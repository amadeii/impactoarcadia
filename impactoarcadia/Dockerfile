FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update   && apt-get install -y --no-install-recommends     ca-certificates     python3     python3-pip     python-is-python3     build-essential   && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

RUN python -m pip install --break-system-packages --no-cache-dir   fastapi   uvicorn   pydantic   pandas   numpy   cryptography

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=5000
ENV AUTH_MODE=local
ENV DISABLE_OIDC=true
ENV DISABLE_LLM_HEALTH_PROBE=true
ENV DB_POOL_MAX=20

EXPOSE 5000

CMD ["npm", "start"]
