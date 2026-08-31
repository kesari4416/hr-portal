#!/bin/bash
# Starts MariaDB using the persistent data directory in /app/mysql-data
# This script is called by supervisor on every pod start.

DATADIR=/app/mysql-data
SOCKET=/run/mysqld/mysqld.sock

mkdir -p /run/mysqld
chown -R root:root $DATADIR 2>/dev/null

# If data dir is empty or missing, initialise it
if [ ! -d "$DATADIR/mysql" ]; then
  echo "Initialising MariaDB data directory at $DATADIR..."
  mysql_install_db --user=root --datadir=$DATADIR --skip-test-db
fi

exec mysqld --user=root --datadir=$DATADIR --socket=$SOCKET \
     --bind-address=127.0.0.1 --port=3306 \
     --innodb-buffer-pool-size=64M
