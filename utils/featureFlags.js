function envBool(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

module.exports = {
  FF_BUSINESS_ENTITIES: envBool("FF_BUSINESS_ENTITIES", false),
  FF_TEAM_MEMBERS: envBool("FF_TEAM_MEMBERS", false),
  FF_SUBSCRIPTION_BY_BUSINESS: envBool("FF_SUBSCRIPTION_BY_BUSINESS", false),
  FF_GENERIC_CATALOG_READS: envBool("FF_GENERIC_CATALOG_READS", false),
};
