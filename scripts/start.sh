#!/bin/sh
set -e

if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data "${UPLOAD_ROOT:-/app/public/uploads}" /app/demo-data
  chown -R nextjs:nodejs /app/data "${UPLOAD_ROOT:-/app/public/uploads}" /app/demo-data
  exec gosu nextjs:nodejs /bin/sh /app/scripts/start.sh
fi

npm run db:migrate

if [ "${SEED_DEMO:-false}" = "true" ]; then
  npm run db:seed
fi

exec npm start
