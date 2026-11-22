"use strict";

function getMacSigningOptions(env = process.env) {
  const hasDeveloperId = Boolean(env.CSC_LINK || env.CSC_NAME);
  return {
    ...(hasDeveloperId ? {} : { identity: "-" }),
    hardenedRuntime: hasDeveloperId,
    enableIdentityAutoDiscovery: Boolean(env.CSC_LINK && !env.CSC_NAME),
  };
}

module.exports = { getMacSigningOptions };
