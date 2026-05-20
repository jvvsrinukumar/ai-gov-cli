export function generateGitlabCI({ hubUrl, existingContent }: { hubUrl?: string; existingContent?: string } = {}): string {
  const hubStage = hubUrl ? `
hub-report:
  stage: test
  image: node:20
  script:
    - developer_hash=$(echo -n "$GITLAB_USER_LOGIN" | sha256sum | awk '{print $1}')
    - >
      curl -sf -X POST ${hubUrl}/api/pr-reports
      -H "Authorization: Bearer $AI_GOV_SECRET"
      -H "Content-Type: application/json"
      -d "{\\"developer_hash\\":\\"$developer_hash\\",\\"project\\":\\"$CI_PROJECT_PATH\\",\\"mr\\":\\"$CI_MERGE_REQUEST_IID\\"}" || true
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
` : '';

  const governanceStage = `
governance-check:
  stage: test
  image: node:20
  before_script:
    - apt-get update && apt-get install -y jq
    - npm install -g ai-gov@20.5.0
  script:
    - ai-gov pr-check --base $CI_MERGE_REQUEST_TARGET_BRANCH_NAME --format gitlab
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
`;

  if (existingContent) {
    return existingContent.trimEnd() + '\n' + governanceStage + hubStage;
  }

  return `stages:
  - test
${governanceStage}${hubStage}`;
}
