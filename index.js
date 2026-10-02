require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const db = require('./db');
const { seedIfEmpty } = require('./seed');
const { app, runEscalationSweep } = require('./app');
const { startEscalationJob } = require('./services/escalations');

async function start() {
  await db.initDatabase();
  await seedIfEmpty();
  await runEscalationSweep();
  const port = Number(process.env.PORT || 4000);
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`GramSetu API is listening on 0.0.0.0:${port}`);
    console.log(`Database: ${db.isPostgres ? 'PostgreSQL' : 'SQLite'} · email: ${process.env.SMTP_HOST ? 'configured' : 'in-app only'}`);
  });
  startEscalationJob();
  const shutdown = async () => {
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch(async (error) => {
  console.error('Could not start GramSetu:', error);
  await db.close();
  process.exit(1);
});
