module.exports = {
  apps: [
    {
      name: 'brandshield-api',
      cwd: './apps/api',
      script: 'npx',
      args: 'tsx src/index.ts',
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: 'brandshield-web',
      cwd: './apps/web',
      script: 'npx',
      args: 'next start --port 4983 --hostname 0.0.0.0',
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
