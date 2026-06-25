// PM2 process file for the Hostinger VPS.
//   npm run build && pm2 start ecosystem.config.js && pm2 save
module.exports = {
  apps: [
    {
      name: "agent-os",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
      max_restarts: 10,
      autorestart: true,
    },
  ],
};
