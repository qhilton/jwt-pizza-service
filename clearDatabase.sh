# Check if host is provided as a command line argument
if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 http://localhost:3000"
  exit 1
fi
host=$1

DB_USER="root"
DB_PASS="Ich00s3y0u!"
DB_NAME="pizza"

echo "Dropping and recreating database '$DB_NAME'..."
mysqlsh --sql -u $DB_USER -p$DB_PASS -e "DROP DATABASE IF EXISTS $DB_NAME"

echo "Database cleared"
