FROM node:22-bookworm-slim AS package
WORKDIR /src
COPY *.html ./
COPY admin admin
COPY js js
COPY css css
COPY assets/icons assets/icons
COPY assets/images/logo assets/images/logo
COPY assets/images/hero assets/images/hero
COPY assets/images/services assets/images/services
COPY services/package-static-site.mjs services/package-static-site.mjs
RUN node services/package-static-site.mjs /srv/site

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3-pil ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /srv/app
COPY --from=package /srv/site /srv/site
COPY services/api services/api
COPY services/admin-api.mjs services/staging-host.mjs ./services/
COPY js/data/categories.js js/data/services.js ./js/data/
ENV NODE_ENV=production VISIONTECH_PYTHON=/usr/bin/python3 PORT=10000
USER node
EXPOSE 10000
CMD ["node","services/staging-host.mjs"]
