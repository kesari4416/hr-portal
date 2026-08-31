#!/bin/bash
# Starts MariaDB using the persistent data directory in /app/mysql-data
# Supervisor calls this on every restart. Guards against double-start.

DATADIR=/app/mysql-data
SOCKET=/run/mysqld/mysqld.sock
# Locate the correct mariadb binary
MYSQLD=$(which mariadbd 2>/dev/null || which mysqld 2>/dev/null || echo "/usr/sbin/mariadbd")

mkdir -p /run/mysqld
chown -R root:root "$DATADIR" 2>/dev/null
chmod 755 /run/mysqld

# Initialize data dir if missing
if [ ! -d "$DATADIR/mysql" ]; then
  echo "Initialising MariaDB data directory at $DATADIR..."
  mysql_install_db --user=root --datadir="$DATADIR" --skip-test-db
fi

# If MySQL is already running (socket exists and responds), monitor it instead of starting a new instance
if mysqladmin --socket="$SOCKET" ping --connect-timeout=3 2>/dev/null; then
  echo "MariaDB already running. Monitoring existing process..."
  PIDFILE=/run/mysqld/mysqld.pid
  MYSQLD_PID=""
  if [ -f "$PIDFILE" ]; then
    MYSQLD_PID=$(cat "$PIDFILE")
  fi
  if [ -z "$MYSQLD_PID" ]; then
    MYSQLD_PID=$(pgrep -x mariadbd 2>/dev/null || pgrep -x mysqld 2>/dev/null | head -1)
  fi
  if [ -n "$MYSQLD_PID" ] && kill -0 "$MYSQLD_PID" 2>/dev/null; then
    echo "Attached to MariaDB PID $MYSQLD_PID. Waiting..."
    while kill -0 "$MYSQLD_PID" 2>/dev/null; do
      sleep 5
    done
    echo "MariaDB PID $MYSQLD_PID exited. Supervisor will restart."
    exit 1
  fi
  # Fallback: sleep while instance is alive
  while mysqladmin --socket="$SOCKET" ping --connect-timeout=3 2>/dev/null; do
    sleep 10
  done
  exit 1
fi

echo "Starting MariaDB using $MYSQLD ..."
exec "$MYSQLD" --user=root \
     --datadir="$DATADIR" \
     --socket="$SOCKET" \
     --bind-address=127.0.0.1 \
     --port=3306 \
     --innodb-buffer-pool-size=64M
