module.exports = {
  apps: [{
    name: 'detective-api',
    script: 'npm',
    args: 'run start',
    cwd: '/opt/detective',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    instance_var: 'INSTANCE_ID',
    exec_mode: 'cluster',
    instances: 1,
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 1000,
    exp_backoff_restart_delay: 100,
  }]
};
