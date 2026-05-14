export function generateBitbucketCI(options?: { hubUrl?: string }): string {
  const hubUrl = options?.hubUrl;

  let hubReportingStep = '';
  if (hubUrl) {
    hubReportingStep = `
      - step:
          name: Report to Governance Hub
          script:
            - apt-get update && apt-get install -y jq
            - npm install -g ai-gov@18.0.0
            - RESULT=$(ai-gov pr-check --format json)
            - DEVELOPER_HASH=$(echo -n "\${BITBUCKET_PR_AUTHOR}" | sha256sum | awk '{print $1}')
            - >-
              curl -s --max-time 10
              -X POST "${hubUrl}/api/pr-reports"
              -H "Content-Type: application/json"
              -H "Authorization: Bearer $AI_GOV_SECRET"
              -d "$(echo "$RESULT" | jq -c --arg hash "$DEVELOPER_HASH" '{project: .project, team: .team, platform: "bitbucket", result: .result, developer_hash: $hash}')"
              || true
`;
  }

  return `image: node:20

pipelines:
  pull-requests:
    '**':
      - step:
          name: Governance Check
          script:
            - apt-get update && apt-get install -y jq
            - npm install -g ai-gov@18.0.0
            - ai-gov pr-check --base $BITBUCKET_PR_DESTINATION_BRANCH --format terminal
${hubReportingStep}`;
}
