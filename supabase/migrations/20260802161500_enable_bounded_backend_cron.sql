create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid)
from cron.job
where jobname in ('sat-auto-mark-prayer-missed-v1', 'sat-cleanup-old-tokens-v1');

select cron.schedule(
  'sat-auto-mark-prayer-missed-v1',
  '*/5 * * * *',
  $command$select sat_private.run_auto_mark_prayer_missed(now(), false);$command$
);

select cron.schedule(
  'sat-cleanup-old-tokens-v1',
  '17 2 * * *',
  $command$select sat_private.run_cleanup_old_tokens(now(), false);$command$
);

comment on extension pg_cron is
  'Runs bounded SAT Mobile maintenance jobs inside Postgres; no service key or external webhook is required.';
