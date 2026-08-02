"use strict";

const SYNTHETIC_INCIDENT_MARKER = "<!-- rivt-production-synthetic-incident -->";
const SYNTHETIC_INCIDENT_TITLE = "Production synthetic check failing";
const PRODUCTION_REPOSITORY_URL = "https://api.github.com/repos/Zboytjbxp/rivt";
const TRUSTED_AUTOMATION_LOGIN = "github-actions[bot]";

function findOwnedSyntheticIncident(issues) {
  return issues.find((issue) => (
    !issue.pull_request
      && issue.title === SYNTHETIC_INCIDENT_TITLE
      && issue.body?.split(/\r?\n/, 1)[0] === SYNTHETIC_INCIDENT_MARKER
      && issue.repository_url === PRODUCTION_REPOSITORY_URL
      && issue.user?.login === TRUSTED_AUTOMATION_LOGIN
      && issue.user?.type === "Bot"
  ));
}

module.exports = {
  SYNTHETIC_INCIDENT_MARKER,
  SYNTHETIC_INCIDENT_TITLE,
  PRODUCTION_REPOSITORY_URL,
  findOwnedSyntheticIncident,
};
