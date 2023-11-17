const fs = require("fs");
const logStream = fs.createWriteStream("log.txt", { flags: "a" });

function logger(message, isError = false) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `${timestamp} - ${message}\n`;

  // Write to log file
  logStream.write(formattedMessage);

  // Also write to console
  if (isError) {
    console.error(formattedMessage);
  } else {
    console.log(formattedMessage);
  }
}

module.exports = { logger };
