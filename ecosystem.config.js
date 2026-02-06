export default {
  apps: [{
    name: 'detective-api',
    script: './node_modules/.bin/next',
    args: 'start',
    cwd: '/opt/detective',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
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
