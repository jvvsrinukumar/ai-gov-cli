export function generateGitlabCI(options?: { hubUrl?: string; existingContent?: string }): string {
  const hubUrl = options?.hubUrl;
  const existingContent = options?.existingContent;

  const hubReportingStep = hubUrl ? `
hub-report:
  stage: test
  image: node:20
  before_script:
    - apt-get update && apt-get install -y jq
    - npm install -g ai-gov@18.0.0
  script:
    - |
      RESULT=$(ai-gov pr-check --base $CI_MERGE_REQUEST_TARGET_BRANCH_NAME --format json)
      DEVELOPER_HASH=$(echo -n "$GITLAB_USER_LOGIN" | sha256sum | awk '{print $1}')
      PAYLOAD=$(echo "$RESULT" | jq -c --arg hash "$DEVELOPER_HASH" --arg platform "gitlab" '{project: .project, team: .team, platform: $platform, result: .result, developer_hash: $hash}')
      curl -s --max-time 10 -X POST "${hubUrl}/api/pr-reports" \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer $AI_GOV_SECRET" \\
        -d "$PAYLOAD" || true
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
` : '';

  const governanceStage = `
governance-check:
  stage: test
  image: node:20
  before_script:
    - apt-get update && apt-get install -y jq
    - npm install -g ai-gov@18.0.0
  script:
    - ai-gov pr-check --base $CI_MERGE_REQUEST_TARGET_BRANCH_NAME --format gitlab
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
`;

  if (existingContent) {
    // Append governance stage (and hub reporting if configured) to existing content
    return existingContent.trimEnd() + '\n' + governanceStage + hubReportingStep;
  }

  // Create minimal .gitlab-ci.yml
  return `stages:
  - test
${governanceStage}${hubReportingStep}`;
}
