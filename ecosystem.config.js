module.exports = {
  apps: [
    {
      name: 'discord-rag-bot',
      script: './src/apps/discord-bot/src/index.ts',
      interpreter_args: '--import tsx --env-file=.env',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--enable-source-maps'
      },
      env_production: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--enable-source-maps'
      },
      // Log configuration
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto restart configuration
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
      
      // Memory and CPU limits
      max_memory_restart: '500M',
      
      // Restart configuration
      restart_delay: 5000,
      max_restarts: 1,
      min_uptime: '10s',
      
      // Advanced configuration
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Source map support for better error tracking
      source_map_support: true,
      
      // Merge logs from all instances
      merge_logs: true,
      
      // Time zone
      time: true
    }
  ],
  
  deploy: {
    production: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:repo.git',
      path: '/var/www/production',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};