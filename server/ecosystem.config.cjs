'use strict';

/** PM2 process file for the API. Paths are the production checkout. Secrets live in server/.env. */
module.exports = {
  apps: [
    {
      name: 'productengineer-api',
      cwd: '/var/www/html/productengineer.pro/website/server',
      script: '/usr/bin/npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '250M',
      env: {
        NODE_ENV: 'production',
        PORT: '8790',
        HOST: '127.0.0.1',
        DB_PATH: '/var/www/html/productengineer.pro/data/productengineer.sqlite',
      },
    },
  ],
};
