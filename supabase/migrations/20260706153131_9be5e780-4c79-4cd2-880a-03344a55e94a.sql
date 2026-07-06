select cron.alter_job(
  job_id := 2,
  command := $cmd$
  select net.http_post(
    url := 'https://project--27301543-3b4f-4b27-807c-eeba8456b0d8-dev.lovable.app/api/public/sync-propostas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZGdkd294d2ZxYnd4bWthdGNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwOTg0OTMsImV4cCI6MjA5ODY3NDQ5M30.5X1Gu_XUAqX8m6s57gcxUBoidZr3rh9w97KEuMXoffw'
    ),
    body := '{}'::jsonb
  );
  $cmd$
);