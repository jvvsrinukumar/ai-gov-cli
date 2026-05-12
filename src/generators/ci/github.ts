export function generateGithubCI(): string {
  return `name: Governance Check
on:
  pull_request:
    branches: [main, develop, master]

permissions:
  pull-requests: write
  contents: read

jobs:
  governance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install jq
        run: sudo apt-get install -y jq

      - name: Install governance CLI
        run: npm install -g ai-gov@17.3.0

      - name: Run governance check
        run: ai-gov pr-check --base \${{ github.event.pull_request.base.ref }} --format github > /tmp/governance-report.md

      - name: Post PR comment
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('/tmp/governance-report.md', 'utf-8');
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner, repo: context.repo.repo,
              issue_number: context.issue.number
            });
            const existing = comments.find(c => c.body.includes('Governance Review'));
            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner, repo: context.repo.repo,
                comment_id: existing.id, body: report
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner, repo: context.repo.repo,
                issue_number: context.issue.number, body: report
              });
            }
`;
}
