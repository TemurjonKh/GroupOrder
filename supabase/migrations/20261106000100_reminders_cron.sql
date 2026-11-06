-- Schedules automatic reminders inside the database. Vercel's free tier only runs
-- cron once a day, which cannot deliver 30- and 10-minute reminders.
create extension if not exists pg_cron;
select cron.schedule('queue-reminders', '*/2 * * * *', 'select public.queue_reminders()');
