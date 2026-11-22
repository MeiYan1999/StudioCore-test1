"use strict";

const packageJson = require("./package.json");
const { getMacSigningOptions } = require("./src/platform/mac-signing");
const signing = getMacSigningOptions(process.env);

if (signing.enableIdentityAutoDiscovery) process.env.CSC_IDENTITY_AUTO_DISCOVERY = "true";
delete signing.enableIdentityAutoDiscovery;

module.exports = {
  ...packageJson.build,
  mac: {
    ...packageJson.build.mac,
    ...signing,
  },
};
