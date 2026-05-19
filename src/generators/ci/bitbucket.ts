export function generateBitbucketCI({ hubUrl }: { hubUrl?: string } = {}): string {
  const hubStep = hubUrl ? `
      - step:
          name: Report to Governance Hub
          script:
            - developer_hash=$(echo -n "\${BITBUCKET_PR_AUTHOR}:bitbucket" | sha256sum | awk '{print $1}')
            - >
              curl -sf -X POST ${hubUrl}/api/pr-reports
              -H "Authorization: Bearer $AI_GOV_SECRET"
              -H "Content-Type: application/json"
              -d "{\\"developer_hash\\":\\"$developer_hash\\",\\"repo\\":\\"$BITBUCKET_REPO_FULL_NAME\\",\\"pr\\":\\"$BITBUCKET_PR_ID\\"}" || true
` : '';

  return `image: node:20

pipelines:
  pull-requests:
    '**':
      - step:
          name: Governance Check
          script:
            - apt-get update && apt-get install -y jq
            - npm install -g ai-gov@20.1.0
            - ai-gov pr-check --base $BITBUCKET_PR_DESTINATION_BRANCH --format terminal
${hubStep}`;
}
