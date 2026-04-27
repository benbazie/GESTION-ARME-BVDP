$ErrorActionPreference = 'Stop'

if (-not $env:PGPASSWORD -or $env:PGPASSWORD -eq '') { $env:PGPASSWORD = 'postgres' }
if (-not $env:PG_HOST -or $env:PG_HOST -eq '') { $env:PG_HOST = 'localhost' }
if (-not $env:PG_USER -or $env:PG_USER -eq '') { $env:PG_USER = 'postgres' }
if (-not $env:PG_DATABASE -or $env:PG_DATABASE -eq '') { $env:PG_DATABASE = 'gestion_armes_vdp' }

& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h $env:PG_HOST -U $env:PG_USER -d $env:PG_DATABASE -At -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;"
