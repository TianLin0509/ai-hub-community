'use strict';
// This immutable source marker is shipped only by the community exporter.
// A config.json or inherited environment cannot enable personal modules.
const fs = require('fs');
const path = require('path');
const community = fs.existsSync(path.join(__dirname, '..', 'community-edition.json'));
module.exports = Object.freeze({ community, personalModules: !community });
