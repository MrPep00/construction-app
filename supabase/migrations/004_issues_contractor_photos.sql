alter table issues add column if not exists contractor text;

alter table files add column if not exists issue_id uuid references issues(id) on delete set null;
create index if not exists files_issue_id_idx on files(issue_id);
