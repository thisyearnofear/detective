module.exports = {
  apps: [{
    name: 'detective-api',
    script: './server.js',
    cwd: '/opt/detective-deploy',
    env: {
      NODE_ENV: 'production',
      PORT: 4000,
    },
    exec_mode: 'fork',
    instances: 1,
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 1000,
    exp_backoff_restart_delay: 100,
  }]
};
