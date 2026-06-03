// Register TypeScript execution support on the fly
register: require('ts-node').register;

// Import your true server.ts file directly
module.exports = require('../server.ts');