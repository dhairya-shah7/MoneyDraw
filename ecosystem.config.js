module.exports = {
  apps: [
    {
      name: 'moneydraw',
      cwd: '/var/www/hunarpay/Withdrawal',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'moneypay',
      cwd: '/var/www/hunarpay/Deposit',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
