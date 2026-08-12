/* Config do projeto Supabase compartilhado ("Coisas do Sebrae"). Site estático sem build step:
   a anon key vive versionada aqui de propósito — a proteção real é a RLS nas tabelas, não o segredo
   da key. Tabelas deste site são prefixadas com meta_inovacao_ dentro do projeto compartilhado. */
window.APP_CONFIG = {
  SUPABASE_URL: "https://wdygbfrmewlaffjsfyoi.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeWdiZnJtZXdsYWZmanNmeW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDc4NzUsImV4cCI6MjEwMjAyMzg3NX0.pkEjfeu51kW6v5YtVDhLqzjB9V73qWPVrbppMrMsn8s"
};
