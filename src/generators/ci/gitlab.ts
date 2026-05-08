export function generateGitlabCI(existingContent?: string): string {
  const governanceStage = `
governance-check:
  stage: test
  image: node:20
  before_script:
    - apt-get update && apt-get install -y jq
    - npm install -g ai-gov@17.1.5
  script:
    - ai-gov pr-check --base $CI_MERGE_REQUEST_TARGET_BRANCH_NAME --format gitlab
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
`;

  if (existingContent) {
    // Append governance stage to existing content
    return existingContent.trimEnd() + '\n' + governanceStage;
  }

  // Create minimal .gitlab-ci.yml
  return `stages:
  - test
${governanceStage}`;
}
