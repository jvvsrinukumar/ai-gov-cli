export function generateBitbucketCI(): string {
  return `image: node:20

pipelines:
  pull-requests:
    '**':
      - step:
          name: Governance Check
          script:
            - apt-get update && apt-get install -y jq
            - npm install -g ai-gov@17.0.0
            - ai-gov pr-check --base $BITBUCKET_PR_DESTINATION_BRANCH --format terminal
`;
}
